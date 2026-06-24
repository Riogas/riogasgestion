# -*- coding: utf-8 -*-
"""ETL cantidades objetivo por escenario/zona/servicio (capital) → movil_cantidad_objetivo.
GXCALDTA.MOVCANTX (MOVCANTESC, MOVCANTZON, MOVCANTSER, MOVCANTCAN, MOVCANTFLA).
No liga a un móvil puntual (parámetro de planificación). Idempotente por origen='capital'."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i


def main():
    a = as400_conn(); ac = a.cursor()
    ac.execute("""SELECT MOVCANTESC, MOVCANTZON, MOVCANTSER, MOVCANTCAN, MOVCANTFLA
        FROM GXCALDTA.MOVCANTX""")
    rows = [('capital', i(r[0]), i(r[1]), i(r[2]), i(r[3]), s(r[4])) for r in ac.fetchall()]
    ac.close(); a.close()
    print("leidos MOVCANTX:", len(rows))

    p = pg_conn(); pc = p.cursor()
    pc.execute("DELETE FROM movil_cantidad_objetivo WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_cantidad_objetivo (origen, escenario, zona, servicio, cantidad, flag) VALUES %s',
        rows, page_size=2000)
    p.commit()
    pc.execute("SELECT count(*) FROM movil_cantidad_objetivo WHERE origen='capital'")
    print("movil_cantidad_objetivo:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK cantidades")


if __name__ == '__main__':
    main()
