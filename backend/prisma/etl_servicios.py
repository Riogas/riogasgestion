# -*- coding: utf-8 -*-
"""ETL catálogo de servicios → servicio (origen='capital').
GXCALDTA.SERVICIO (SERID → SERNOM). Resuelve movil_servicio.servicioId.
Idempotente: DELETE WHERE origen='capital' antes de insertar."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i


def main():
    a = as400_conn(); ac = a.cursor()
    ac.execute("SELECT SERID, SERNOM FROM GXCALDTA.SERVICIO")
    rows = [('capital', i(r[0]), s(r[1])) for r in ac.fetchall()]
    ac.close(); a.close()
    print("leidos SERVICIO:", len(rows))

    p = pg_conn(); pc = p.cursor()
    pc.execute("DELETE FROM servicio WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO servicio (origen, "idOriginal", nombre) VALUES %s',
        rows, page_size=1000)
    p.commit()

    pc.execute("SELECT count(*) FROM servicio WHERE origen='capital'")
    print("servicio:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK servicios")


if __name__ == '__main__':
    main()
