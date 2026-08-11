# -*- coding: utf-8 -*-
"""Re-import de GXCALDTA.CLIENTE -> goya.cliente + direccion con calle OSM.

A diferencia de etl_clientes.py (TRUNCATE, solo para la carga inicial), esto
es un UPSERT: refresca las columnas espejo del AS400 y NO toca las columnas
calculadas por goya (geoLat/geoLng/calleGeo/etc. del backfill geoinverso).

Despues reconstruye `direccion` para todo cliente con calle principal:
  - calle y esquinas usan el nombre OSM si el CALID tiene match CONFIRMADO
    (AUTO_CONFIRMADO o CONFIRMADO_MANUAL del puente nomenclator<->OSM);
  - si no hay match confirmado, queda el nombre del nomenclator del AS400.
Mismo formato que el backfill: "Calle 123, esq. X y Y, Apto 4, Localidad".
Los clientes SIN calle principal no se tocan (conservan su direccion previa).

Uso:  python reimport_clientes.py
"""
import datetime as dt
import sys

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

import psycopg2
from psycopg2.extras import execute_values

from _creds import pg_conn_args

PG = pg_conn_args()

# Columnas que NO se actualizan en el upsert: la PK, el createdAt original y
# (por omision) todas las calculadas por goya que no estan en DST_COLS.
NO_ACTUALIZAR = {'id', 'createdAt'}


def construir_direccion(calle, nro, bis, esq1, esq2, solar, mz, apto, km, localidad):
    """Mismo formato que backfill_geo.construir_direccion."""
    partes = []
    base = (calle or '').strip()
    if nro:
        base = (base + ' ' + str(nro)).strip()
    if bis:
        base = (base + ' ' + str(bis)).strip()
    if base:
        partes.append(base)
    esquinas = [e for e in (esq1, esq2) if e]
    if esquinas:
        partes.append('esq. ' + ' y '.join(esquinas))
    if solar:
        partes.append('Solar ' + str(solar))
    if mz:
        partes.append('Mz ' + str(mz))
    if apto:
        partes.append('Apto ' + str(apto))
    if km:
        partes.append('Km ' + str(km))
    if localidad:
        partes.append(localidad)
    return ', '.join(partes)[:300] or None


def upsert_desde_as400() -> tuple[int, int]:
    # Imports acá adentro: la fase --solo-direcciones corre también en los
    # servers Linux, que no tienen jt400/JVM.
    import jaydebeapi
    from etl_clientes import (
        AS400_JAR, AS400_PROPS, AS400_URL, BATCH, DST_COLS, SRC_COLS, transform,
    )

    print('Conectando AS400...')
    src = jaydebeapi.connect('com.ibm.as400.access.AS400JDBCDriver',
                             AS400_URL, AS400_PROPS, AS400_JAR)
    scur = src.cursor()
    scur.execute(f"SELECT {', '.join(SRC_COLS)} FROM GXCALDTA.CLIENTE")

    pg = psycopg2.connect(**PG)
    pcur = pg.cursor()
    pcur.execute('SELECT COUNT(*) FROM cliente')
    antes = pcur.fetchone()[0]

    cols_sql = ', '.join(f'"{c}"' for c in DST_COLS)
    sets = ', '.join(
        f'"{c}" = EXCLUDED."{c}"' for c in DST_COLS if c not in NO_ACTUALIZAR
    )
    sql = (f'INSERT INTO cliente ({cols_sql}) VALUES %s '
           f'ON CONFLICT (id) DO UPDATE SET {sets}')

    now = dt.datetime.now()
    total = 0
    while True:
        rows = scur.fetchmany(BATCH)
        if not rows:
            break
        execute_values(pcur, sql, [transform(r, now) for r in rows],
                       page_size=BATCH)
        pg.commit()
        total += len(rows)
        if total % 100000 == 0:
            print(f'  upsert: {total:,}...')
    scur.close()
    src.close()

    pcur.execute('SELECT COUNT(*) FROM cliente')
    despues = pcur.fetchone()[0]
    pcur.close()
    pg.close()
    print(f'upsert AS400: {total:,} filas ({despues - antes:+,} nuevas, '
          f'total {despues:,})')
    return total, despues - antes


def reconstruir_direcciones() -> tuple[int, int]:
    # Dos conexiones: la lectora (cursor con nombre, server-side) no comitea
    # jamás — un commit en la misma conexión invalida el cursor con nombre.
    pg = psycopg2.connect(**PG)
    pg_lector = psycopg2.connect(**PG)
    pcur = pg.cursor()

    # Nombre final por CALID: OSM confirmado gana, nomenclator es el piso.
    pcur.execute('SELECT id, nombre, "ciudadId" FROM calle')
    nombres = {}
    ciudad_de_calle = {}
    for cid, nom, ciu in pcur.fetchall():
        nombres[cid] = nom
        ciudad_de_calle[cid] = ciu

    pcur.execute('''SELECT DISTINCT ON (m."calleId") m."calleId", o.nombre
                    FROM calle_match m
                    JOIN calle_osm o ON o.id = m."calleOsmId" AND o.activo
                    WHERE m.estado IN ('AUTO_CONFIRMADO', 'CONFIRMADO_MANUAL')
                    ORDER BY m."calleId",
                             (m.estado = 'CONFIRMADO_MANUAL') DESC,
                             m.score DESC''')
    con_osm = 0
    for cid, nombre_osm in pcur.fetchall():
        if cid in nombres:
            nombres[cid] = nombre_osm
            con_osm += 1
    print(f'nombres de calle: {len(nombres):,} ({con_osm:,} con nombre OSM confirmado)')

    pcur.execute('SELECT id, nombre FROM ciudad_nomenclator')
    ciudades = dict(pcur.fetchall())

    lector = pg_lector.cursor(name='clientes_dir')  # server-side, no carga todo en RAM
    lector.itersize = 20000
    lector.execute('''SELECT id, "callePrincipalId", "calleEsquina1Id",
                             "calleEsquina2Id", "numeroPuerta", bis,
                             "blockSolar", "numeroManzana", apartamento, km,
                             "localidadGeo"
                      FROM cliente WHERE "callePrincipalId" IS NOT NULL''')

    escritor = pg.cursor()
    actualizadas = 0
    lote = []
    for (cid, calprin, esq1, esq2, nro, bis, solar, mz, apto, km,
         loc_geo) in lector:
        localidad = loc_geo or ciudades.get(ciudad_de_calle.get(calprin))
        direccion = construir_direccion(
            nombres.get(calprin), nro, bis,
            nombres.get(esq1), nombres.get(esq2),
            solar, mz, apto, km, localidad,
        )
        lote.append((cid, direccion))
        if len(lote) >= 20000:
            execute_values(
                escritor,
                'UPDATE cliente AS c SET direccion = v.direccion '
                'FROM (VALUES %s) AS v(id, direccion) WHERE c.id = v.id',
                lote, page_size=5000,
            )
            pg.commit()
            actualizadas += len(lote)
            lote = []
            if actualizadas % 100000 == 0:
                print(f'  direcciones: {actualizadas:,}...')
    if lote:
        execute_values(
            escritor,
            'UPDATE cliente AS c SET direccion = v.direccion '
            'FROM (VALUES %s) AS v(id, direccion) WHERE c.id = v.id',
            lote, page_size=5000,
        )
        pg.commit()
        actualizadas += len(lote)

    lector.close()
    pg_lector.close()
    escritor.close()
    pg.close()
    return actualizadas, con_osm


def main():
    t0 = dt.datetime.now()
    if '--solo-direcciones' not in sys.argv:
        upsert_desde_as400()
    actualizadas, con_osm = reconstruir_direcciones()
    print(f'direcciones reconstruidas: {actualizadas:,} '
          f'(calles con nombre OSM: {con_osm:,})')
    print(f'REIMPORT OK en {(dt.datetime.now() - t0).seconds}s')


if __name__ == '__main__':
    main()
