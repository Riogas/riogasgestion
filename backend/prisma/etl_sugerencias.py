# -*- coding: utf-8 -*-
"""Motor de sugerencias -> match_sugerencia (Tasks 3.1 + 3.2, spec 2026-07-07).

No fusiona nada: solo emite PARES candidatos a `match_sugerencia` (estado
PENDIENTE por default), que después resuelve el workbench (aceptar/rechazar).
Idempotente: nunca re-inserta un par ya presente para el mismo `tipo`
(el chequeo NOT EXISTS es por (tipo, colA, colB), sin importar la `senal`;
si un mismo par matchea por más de una señal, se procesa en orden de mayor
confianza primero y gana esa señal).

--tipo duplicado:
  CEDULA:      cliente_uni con misma cédula no nula          -> confianza 0.99
  RUC:         cliente_uni con mismo ruc válido (no ''/'0')  -> confianza 0.9
  TEL+NOMBRE:  teléfono activo compartido (2..50 clientes) +
               nombre similar (rapidfuzz token_sort >= 85)   -> confianza ratio/100
  registroA/registroB = cliente_uni.id (LEAST/GREATEST).

--tipo hogar:
  MISMA_DIRECCION: cliente_direccion agrupadas por direccionTextoNorm no
                    vacío, con >=2 personas distintas             -> confianza 0.9
  PROXIMIDAD_GEO:  direcciones con lat/lng, distinta persona, a
                    <= HOGAR_PROXIMIDAD_METROS (env, default 25)  -> confianza 0.7
  personaA/personaB = persona.id (LEAST/GREATEST).

Uso:
  python etl_sugerencias.py --tipo duplicado
  python etl_sugerencias.py --tipo hogar
  python etl_sugerencias.py                 # ambos (default: all)
  HOGAR_PROXIMIDAD_METROS=30 python etl_sugerencias.py --tipo hogar
"""
import argparse
import itertools
import os
import re
import unicodedata

import psycopg2
from psycopg2.extras import execute_values
from rapidfuzz import fuzz

from _creds import pg_conn_args

# Cota de tamaño de grupo para evitar una explosión combinatoria (C(n,2)) en
# claves "basura" que agrupan de más (cédula/ruc/dirección placeholder,
# número de teléfono genérico, etc.). Mismo criterio que dedup_clientes.py.
MAX_GRUPO = 50


def norm(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def insertar_pares(cur, tipo, filas, cols=('registroA', 'registroB')):
    """filas: list[(a, b, senal, confianza)]. Idempotente por (tipo, colA, colB)."""
    if not filas:
        return 0
    col_a, col_b = cols
    sql = (
        f'INSERT INTO match_sugerencia (tipo, "{col_a}", "{col_b}", senal, confianza) '
        f'SELECT v.tipo, v.a, v.b, v.senal, v.confianza '
        f'FROM (VALUES %s) AS v(tipo, a, b, senal, confianza) '
        f'WHERE NOT EXISTS (SELECT 1 FROM match_sugerencia ms '
        f'WHERE ms.tipo=v.tipo AND ms."{col_a}"=v.a AND ms."{col_b}"=v.b) '
        f'RETURNING 1'
    )
    rows = [(tipo, a, b, senal, confianza) for a, b, senal, confianza in filas]
    ids = execute_values(cur, sql, rows, template='(%s,%s,%s,%s,%s)', page_size=2000, fetch=True)
    return len(ids)


def pares_por_grupo(cur, sql, min_grupo=2, max_grupo=MAX_GRUPO):
    """sql debe devolver filas (clave, array_agg(id)). Devuelve set de pares (a<b)."""
    cur.execute(sql)
    pares = set()
    for _clave, ids in cur.fetchall():
        ids = sorted({x for x in ids if x is not None})
        if len(ids) < min_grupo or len(ids) > max_grupo:
            continue
        pares.update(itertools.combinations(ids, 2))
    return pares


def pares_tel_nombre(cur):
    """Teléfono activo compartido (2..50 clientes) + nombre similar. Devuelve
    dict (a,b) -> ratio (0-100), quedándose con el mayor ratio si el mismo
    par comparte más de un número."""
    cur.execute("""
        SELECT t.numero, array_agg(DISTINCT t."clienteId") AS clientes
        FROM cliente_telefono t
        WHERE t.estado='A' AND t.numero IS NOT NULL AND length(btrim(t.numero))>=6
        GROUP BY t.numero
        HAVING count(DISTINCT t."clienteId") BETWEEN 2 AND %s
    """, (MAX_GRUPO,))
    grupos = cur.fetchall()

    ids = sorted({cid for _, lst in grupos for cid in lst})
    nombres = {}
    for i in range(0, len(ids), 5000):
        chunk = ids[i:i + 5000]
        cur.execute('SELECT id, nombre FROM cliente_uni WHERE id = ANY(%s)', (chunk,))
        for r in cur.fetchall():
            nombres[r[0]] = norm(r[1])

    pares = {}
    for _numero, lst in grupos:
        lst = sorted({x for x in lst if x in nombres})
        for a, b in itertools.combinations(lst, 2):
            na, nb = nombres[a], nombres[b]
            if not na or not nb:
                continue
            ratio = fuzz.token_sort_ratio(na, nb)
            if ratio >= 85 and ratio > pares.get((a, b), -1):
                pares[(a, b)] = ratio
    return pares


def duplicado(cur, conn):
    print("=== DUPLICADO ===")
    total = 0

    # CEDULA
    pares = pares_por_grupo(cur, """
        SELECT cedula, array_agg(id) FROM cliente_uni
        WHERE cedula IS NOT NULL AND btrim(cedula) <> ''
        GROUP BY cedula HAVING count(*) > 1
    """)
    filas = [(a, b, 'CEDULA', 0.99) for a, b in pares]
    n = insertar_pares(cur, 'DUPLICADO', filas)
    conn.commit()
    print(f"  CEDULA: candidatos={len(pares):,} insertados={n:,}")
    total += n

    # RUC
    pares = pares_por_grupo(cur, """
        SELECT ruc, array_agg(id) FROM cliente_uni
        WHERE ruc IS NOT NULL AND btrim(ruc) NOT IN ('', '0')
        GROUP BY ruc HAVING count(*) > 1
    """)
    filas = [(a, b, 'RUC', 0.9) for a, b in pares]
    n = insertar_pares(cur, 'DUPLICADO', filas)
    conn.commit()
    print(f"  RUC: candidatos={len(pares):,} insertados={n:,}")
    total += n

    # TEL+NOMBRE
    pares_ratio = pares_tel_nombre(cur)
    filas = [(a, b, 'TEL+NOMBRE', ratio / 100) for (a, b), ratio in pares_ratio.items()]
    n = insertar_pares(cur, 'DUPLICADO', filas)
    conn.commit()
    print(f"  TEL+NOMBRE: candidatos={len(pares_ratio):,} insertados={n:,}")
    total += n

    print(f"DUPLICADO total insertados: {total:,}")


def hogar(cur, conn):
    print("=== HOGAR ===")
    total = 0

    # MISMA_DIRECCION: mismo direccionTextoNorm, >=2 personas distintas.
    pares = pares_por_grupo(cur, """
        SELECT cd."direccionTextoNorm", array_agg(DISTINCT cu."personaId")
        FROM cliente_direccion cd
        JOIN cliente_uni cu ON cu.id = cd."clienteId"
        WHERE cd."direccionTextoNorm" IS NOT NULL AND cd."direccionTextoNorm" <> ''
          AND cu."personaId" IS NOT NULL
        GROUP BY cd."direccionTextoNorm"
        HAVING count(DISTINCT cu."personaId") > 1
    """)
    filas = [(a, b, 'MISMA_DIRECCION', 0.9) for a, b in pares]
    n = insertar_pares(cur, 'HOGAR', filas, cols=('personaA', 'personaB'))
    conn.commit()
    print(f"  MISMA_DIRECCION: candidatos={len(pares):,} insertados={n:,}")
    total += n

    # PROXIMIDAD_GEO: direcciones con lat/lng a <= HOGAR_PROXIMIDAD_METROS,
    # distinta persona. El cross join se restringe a la MISMA localidadId
    # (evita comparar todo el país entre sí) y además a un bounding-box en
    # grados (barato, antes del cálculo trigonométrico) como segunda cota
    # práctica; sin esto, una localidad grande (ej. Montevideo) generaría un
    # producto cruzado enorme.
    #
    # NOTA operador: este self-join necesita el índice de
    # backend/prisma/sql/2026-07-07_cliente_direccion_geo_idx.sql sobre
    # cliente_direccion("localidadId", lat, lng). Aplicarlo ANTES de correr
    # esta sección (sin índice de soporte, es un scan completo por cada fila
    # de cliente_direccion con lat/lng).
    metros = float(os.environ.get('HOGAR_PROXIMIDAD_METROS', '25'))
    margen_grados = (metros / 111000) * 1.5  # ~111km por grado de latitud, con margen
    cur.execute("""
        SELECT cd1.id AS ancla,
               LEAST(cu1."personaId", cu2."personaId") AS pa,
               GREATEST(cu1."personaId", cu2."personaId") AS pb
        FROM cliente_direccion cd1
        JOIN cliente_uni cu1 ON cu1.id = cd1."clienteId"
        JOIN cliente_direccion cd2
          ON cd2."localidadId" = cd1."localidadId"
         AND cd2.id > cd1.id
         AND cd2.lat BETWEEN cd1.lat - %s AND cd1.lat + %s
         AND cd2.lng BETWEEN cd1.lng - %s AND cd1.lng + %s
        JOIN cliente_uni cu2 ON cu2.id = cd2."clienteId"
        WHERE cd1.lat IS NOT NULL AND cd1.lng IS NOT NULL
          AND cd2.lat IS NOT NULL AND cd2.lng IS NOT NULL
          AND cu1."personaId" IS NOT NULL AND cu2."personaId" IS NOT NULL
          AND cu1."personaId" <> cu2."personaId"
          AND 6371000 * 2 * asin(sqrt(
                power(sin(radians(cd2.lat - cd1.lat) / 2), 2)
                + cos(radians(cd1.lat)) * cos(radians(cd2.lat))
                  * power(sin(radians(cd2.lng - cd1.lng) / 2), 2)
              )) <= %s
    """, (margen_grados, margen_grados, margen_grados, margen_grados, metros))

    # Cota MAX_GRUPO por ancla (misma idea que pares_por_grupo): si una sola
    # dirección matchea con más de MAX_GRUPO direcciones distintas dentro del
    # radio (edificio/torre denso, coordenadas mal geolocalizadas apuntando
    # todas al mismo portón, etc.), se descarta ese grupo entero en vez de
    # inundar match_sugerencia con cientos de pares de una sola dirección
    # basura.
    pares_por_ancla = {}
    for ancla, pa, pb in cur.fetchall():
        pares_por_ancla.setdefault(ancla, set()).add((pa, pb))

    pares = set()
    for _ancla, par_set in pares_por_ancla.items():
        if len(par_set) > MAX_GRUPO:
            continue
        pares.update(par_set)

    filas = [(a, b, 'PROXIMIDAD_GEO', 0.7) for a, b in pares]
    n = insertar_pares(cur, 'HOGAR', filas, cols=('personaA', 'personaB'))
    conn.commit()
    print(f"  PROXIMIDAD_GEO (<= {metros:.0f}m): candidatos={len(filas):,} insertados={n:,}")
    total += n

    print(f"HOGAR total insertados: {total:,}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tipo', choices=['duplicado', 'hogar', 'all'], default='all')
    args = ap.parse_args()

    conn = psycopg2.connect(**pg_conn_args())
    cur = conn.cursor()

    if args.tipo in ('duplicado', 'all'):
        duplicado(cur, conn)
    if args.tipo in ('hogar', 'all'):
        hogar(cur, conn)

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
