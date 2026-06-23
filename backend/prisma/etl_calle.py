# -*- coding: utf-8 -*-
"""ETL catálogo de calles: GXCALDTA.CALLE (AS400) -> goya.public.calle.
Re-ejecutable (TRUNCATE + insert batcheado)."""
import os
os.environ['JAVA_HOME'] = r'C:\Program Files\Java\jdk-21'
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


def main():
    a = jaydebeapi.connect("com.ibm.as400.access.AS400JDBCDriver", AS400_URL, AS400_PROPS, AS400_JAR)
    ac = a.cursor()
    ac.execute("SELECT CALID, CALNOM, CALNOMICA FROM GXCALDTA.CALLE")
    rows = [(int(r[0]), clean(r[1]), clean(r[2])) for r in ac.fetchall() if r[0] is not None]
    ac.close(); a.close()
    print(f"Leídas {len(rows)} calles del AS400")

    p = psycopg2.connect(**PG); pc = p.cursor()
    pc.execute('TRUNCATE TABLE calle')
    execute_values(pc,
        'INSERT INTO calle (id, nombre, "nombreIca", "createdAt") VALUES %s',
        [(r[0], r[1], r[2]) for r in rows],
        template='(%s,%s,%s,NOW())', page_size=2000)
    p.commit()
    pc.execute('SELECT COUNT(*) FROM calle')
    print("calle en goya:", pc.fetchone()[0])
    pc.close(); p.close()


if __name__ == '__main__':
    main()
