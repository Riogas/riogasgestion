# -*- coding: utf-8 -*-
"""ETL ampliado del nomenclator: GXCALDTA.{CALLE,CIUDAD,DEPTO} -> goya.

Puente nomenclator<->OSM (spec 2026-08-11). Solo LECTURA del AS400.
Re-ejecutable: upsert por id, no trunca `calle` (otras features la referencian).
Al final calcula cantClientesReal 100% local desde goya.cliente
(callePrincipalId + calleEsquina1Id + calleEsquina2Id).

Encoding: CCSID 284 viaja bien por jt400 (verificado 2026-08-11, la N con
virgulilla llega perfecta). El bug historico del ETL viejo no se repite aca.
"""
import os
import sys

os.environ.setdefault('JAVA_HOME', r'C:\Program Files\Java\jdk-21')
sys.stdout.reconfigure(encoding='utf-8')

import jaydebeapi
import psycopg2
from psycopg2.extras import execute_values

from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()
PG = pg_conn_args()


def clean(s):
    if s is None:
        return None
    s = str(s).strip()
    return s if s else None


def num(v):
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def dec(v):
    if v is None:
        return None
    try:
        f = float(v)
        return f if f != 0 else None  # 0.0 en el AS400 es "sin dato"
    except (TypeError, ValueError):
        return None


def main():
    a = jaydebeapi.connect(
        'com.ibm.as400.access.AS400JDBCDriver', AS400_URL, AS400_PROPS, AS400_JAR
    )
    ac = a.cursor()

    # ---- DEPTO (20) ----
    ac.execute('SELECT DEPID, DEPNOM FROM GXCALDTA.DEPTO')
    deptos = [(num(r[0]), clean(r[1])) for r in ac.fetchall() if r[0] is not None]
    print(f'AS400 DEPTO: {len(deptos)}')

    # ---- CIUDAD (81) ----
    ac.execute(
        """SELECT CIUID, DEPID, CIUNOM, CIUNOMABRE, CIUESTADO, CIUCORDX, CIUCORDY
           FROM GXCALDTA.CIUDAD"""
    )
    ciudades = [
        (num(r[0]), num(r[1]), clean(r[2]), clean(r[3]), clean(r[4]), dec(r[5]), dec(r[6]))
        for r in ac.fetchall()
        if r[0] is not None
    ]
    print(f'AS400 CIUDAD: {len(ciudades)}')
    depto_de_ciudad = {c[0]: c[1] for c in ciudades}

    # ---- CALLE (13.170) ----
    ac.execute(
        """SELECT CALID, CALNOM, CALNOMICA, EXCALNOM, CIUID, CALVISIBLE,
                  CALCANTCLI, CALCODICA, CALTRAMICA, CALCORDX, CALCORDY
           FROM GXCALDTA.CALLE"""
    )
    calles = []
    for r in ac.fetchall():
        if r[0] is None:
            continue
        ciu = num(r[4])
        calles.append((
            num(r[0]), clean(r[1]), clean(r[2]), clean(r[3]), ciu,
            depto_de_ciudad.get(ciu), clean(r[5]), num(r[6]),
            num(r[7]), num(r[8]), dec(r[9]), dec(r[10]),
        ))
    print(f'AS400 CALLE: {len(calles)}')
    ac.close()
    a.close()

    p = psycopg2.connect(**PG)
    pc = p.cursor()

    execute_values(
        pc,
        'INSERT INTO depto_nomenclator (id, nombre) VALUES %s '
        'ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre',
        deptos,
    )

    execute_values(
        pc,
        'INSERT INTO ciudad_nomenclator '
        '(id, "deptoId", nombre, "nombreAbre", estado, "cordX", "cordY") VALUES %s '
        'ON CONFLICT (id) DO UPDATE SET "deptoId"=EXCLUDED."deptoId", '
        'nombre=EXCLUDED.nombre, "nombreAbre"=EXCLUDED."nombreAbre", '
        'estado=EXCLUDED.estado, "cordX"=EXCLUDED."cordX", "cordY"=EXCLUDED."cordY"',
        ciudades,
    )

    # Upsert de calle: NO tocar filas que otras features ya usan mas alla
    # de refrescar los campos espejo. id = CALID.
    execute_values(
        pc,
        'INSERT INTO calle (id, nombre, "nombreIca", "exNombre", "ciudadId", '
        '"deptoId", visible, "cantClientesAs400", "codIca", "tramoIca", '
        '"cordX", "cordY", "createdAt", "actualizadoAt") VALUES %s '
        'ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, '
        '"nombreIca"=EXCLUDED."nombreIca", "exNombre"=EXCLUDED."exNombre", '
        '"ciudadId"=EXCLUDED."ciudadId", "deptoId"=EXCLUDED."deptoId", '
        'visible=EXCLUDED.visible, "cantClientesAs400"=EXCLUDED."cantClientesAs400", '
        '"codIca"=EXCLUDED."codIca", "tramoIca"=EXCLUDED."tramoIca", '
        '"cordX"=EXCLUDED."cordX", "cordY"=EXCLUDED."cordY", '
        '"actualizadoAt"=NOW()',
        calles,
        template='(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
        page_size=2000,
    )
    p.commit()

    # ---- Conteos reales, 100% local ----
    print('Calculando cantClientesReal desde goya.cliente...')
    pc.execute(
        '''WITH uso AS (
             SELECT "callePrincipalId" AS cid, COUNT(*) AS n FROM cliente
               WHERE "callePrincipalId" IS NOT NULL GROUP BY 1
             UNION ALL
             SELECT "calleEsquina1Id", COUNT(*) FROM cliente
               WHERE "calleEsquina1Id" IS NOT NULL GROUP BY 1
             UNION ALL
             SELECT "calleEsquina2Id", COUNT(*) FROM cliente
               WHERE "calleEsquina2Id" IS NOT NULL GROUP BY 1
           ), tot AS (SELECT cid, SUM(n)::int AS total FROM uso GROUP BY cid)
           UPDATE calle SET "cantClientesReal" = tot.total
           FROM tot WHERE calle.id = tot.cid'''
    )
    print(f'  calles con uso real: {pc.rowcount}')
    pc.execute(
        'UPDATE calle SET "cantClientesReal" = 0 WHERE "cantClientesReal" IS NULL'
    )
    p.commit()

    # ---- Verificacion ----
    for sql, titulo in [
        ('SELECT COUNT(*) FROM depto_nomenclator', 'deptos'),
        ('SELECT COUNT(*) FROM ciudad_nomenclator', 'ciudades'),
        ('SELECT COUNT(*) FROM calle', 'calles'),
        ('SELECT COUNT(*) FROM calle WHERE "ciudadId" IS NOT NULL', 'calles con ciudad'),
        ('SELECT COUNT(*) FROM calle WHERE "exNombre" IS NOT NULL', 'calles con ex-nombre'),
        ("SELECT COUNT(*) FROM calle WHERE nombre LIKE '%Ñ%' OR nombre LIKE '%ñ%'", 'calles con Ñ'),
    ]:
        pc.execute(sql)
        print(f'  {titulo}: {pc.fetchone()[0]}')

    pc.execute(
        '''SELECT c.id, c.nombre, cn.nombre AS ciudad, d.nombre AS depto,
                  c."cantClientesReal", c."cantClientesAs400"
           FROM calle c
           LEFT JOIN ciudad_nomenclator cn ON cn.id = c."ciudadId"
           LEFT JOIN depto_nomenclator d ON d.id = c."deptoId"
           ORDER BY c."cantClientesReal" DESC NULLS LAST LIMIT 8'''
    )
    print('\nTop calles por clientes reales:')
    for row in pc.fetchall():
        print('  ', ' | '.join('' if v is None else str(v) for v in row))

    pc.close()
    p.close()
    print('\nETL OK')


if __name__ == '__main__':
    main()
