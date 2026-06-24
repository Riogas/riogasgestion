# -*- coding: utf-8 -*-
"""ETL catálogos del esquema PUESTOS (AS400) -> goya:
puesto, departamento, localidad, tipo_cliente, categoria_precio, zona.
+ crea puesto id=100 'Montevideo' para los clientes de capital. Re-ejecutable."""
import os
os.environ['JAVA_HOME'] = r'C:\Program Files\Java\jdk-21'
import jaydebeapi
import psycopg2
from psycopg2.extras import execute_values
from decimal import Decimal, InvalidOperation
from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()
PG = pg_conn_args()
MONTEVIDEO_PUESTO_ID = 100


def s(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def dec(v):
    try:
        d = Decimal(str(v))
        return d if d != 0 else None
    except (InvalidOperation, TypeError, ValueError):
        return None


def i(v):
    try:
        n = int(Decimal(str(v)))
        return n
    except (InvalidOperation, TypeError, ValueError):
        return None


def main():
    a = jaydebeapi.connect("com.ibm.as400.access.AS400JDBCDriver", AS400_URL, AS400_PROPS, AS400_JAR)
    ac = a.cursor()
    p = psycopg2.connect(**PG); pc = p.cursor()

    def load(sql, transform, table, cols, template):
        ac.execute(sql)
        rows = [transform(r) for r in ac.fetchall()]
        rows = [r for r in rows if r and r[0] is not None]
        # dedupe por PK (col 0)
        seen = {}
        for r in rows:
            seen[r[0]] = r
        rows = list(seen.values())
        pc.execute(f'TRUNCATE TABLE {table} CASCADE')
        execute_values(pc, f'INSERT INTO {table} ({cols}) VALUES %s', rows, template=template, page_size=2000)
        p.commit()
        pc.execute(f'SELECT COUNT(*) FROM {table}')
        print(f"  {table}: {pc.fetchone()[0]}")

    # departamento
    load("SELECT DEPARTAMENTOID,DEPARTAMENTONOMBRE,DEPARTAMENTOESTADO FROM PUESTOS.DEPARTAMENTO",
         lambda r: (i(r[0]), s(r[1]), s(r[2])), 'departamento', 'id,nombre,estado', '(%s,%s,%s)')
    # localidad ← CIUDAD (es lo que referencian los clientes vía CIUDADID; ids chicos).
    # La tabla LOCALIDAD (1406, con lat/lon) tiene ids de 13 dígitos no referenciados → enriquecimiento futuro.
    load("SELECT CIUID,DEPID,CIUNOM,CIUESTADO FROM PUESTOS.CIUDAD",
         lambda r: (i(r[0]), i(r[1]), s(r[2]), None, None, s(r[3])),
         'localidad', 'id,"departamentoId",nombre,lat,lng,estado', '(%s,%s,%s,%s,%s,%s)')
    # tipo_cliente
    load("SELECT TIPOCLIENTEID,TIPOCLIENTEDESCRIPCION,TIPOCLIENTEESTADO FROM PUESTOS.TIPOCLIENTE",
         lambda r: (i(r[0]), s(r[1]), s(r[2])), 'tipo_cliente', 'id,descripcion,estado', '(%s,%s,%s)')
    # zona
    load("SELECT ZONID,ZONPUESTOID,ZONNOM,ZONFLETECOBRA,ZONFLETECANTIDAD,ZONESTADO FROM PUESTOS.ZONA",
         lambda r: (i(r[0]), i(r[1]), s(r[2]), s(r[3]), s(r[4]), s(r[5])),
         'zona', 'id,"puestoId",nombre,"fleteCobra","fleteCantidad",estado', '(%s,%s,%s,%s,%s,%s)')

    # puesto (lat=PUESTOSCOORDX, lng=PUESTOSCOORDY) + Montevideo
    ac.execute("""SELECT PUESTOID,PUESTODSC,PUESTODIR,PUESTOZONID,PUESTOFLETECOBRA,PUESTOFLETECANTIDAD,
                  PUESTOAUTOPEDIDO,PUESTOHORARIOS,PUESTOMAIL,PUESTOPROPIO,PUESTOSCOORDX,PUESTOSCOORDY,PUESTOESTADO
                  FROM PUESTOS.PUESTOS""")
    puestos = []
    for r in ac.fetchall():
        puestos.append((i(r[0]), s(r[1]), s(r[2]), None, i(r[3]), s(r[4]), s(r[5]), s(r[6]),
                        s(r[7]), s(r[8]), s(r[9]), dec(r[10]), dec(r[11]), s(r[12])))
    # depto Montevideo
    pc.execute("SELECT id FROM departamento WHERE upper(nombre) LIKE 'MONTEVIDEO%'")
    row = pc.fetchone(); mvd_dep = row[0] if row else None
    puestos.append((MONTEVIDEO_PUESTO_ID, 'Montevideo', None, mvd_dep, None, None, None, None, None, None, 'S', None, None, 'A'))
    seen = {}
    for r in puestos:
        seen[r[0]] = r
    pc.execute('TRUNCATE TABLE puesto CASCADE')
    execute_values(pc,
        'INSERT INTO puesto (id,nombre,direccion,"departamentoId","zonaId","fleteCobra","fleteCantidad",'
        'autopedido,horarios,mail,propio,lat,lng,estado) VALUES %s',
        [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13]) for r in seen.values()],
        template='(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', page_size=200)
    p.commit()
    pc.execute('SELECT COUNT(*) FROM puesto'); print(f"  puesto: {pc.fetchone()[0]} (incl. Montevideo dep={mvd_dep})")

    # categoria_precio
    ac.execute("SELECT PUESTOID,CATID,CATDSC,CATACT FROM PUESTOS.CATEGORIA")
    cats = [(i(r[0]), i(r[1]), s(r[2]), s(r[3])) for r in ac.fetchall()]
    pc.execute('TRUNCATE TABLE categoria_precio CASCADE')
    execute_values(pc, 'INSERT INTO categoria_precio ("puestoId","catId",nombre,activo) VALUES %s',
                   cats, template='(%s,%s,%s,%s)', page_size=500)
    p.commit()
    pc.execute('SELECT COUNT(*) FROM categoria_precio'); print(f"  categoria_precio: {pc.fetchone()[0]}")

    ac.close(); a.close(); pc.close(); p.close()
    print("OK catálogos")


if __name__ == '__main__':
    main()
