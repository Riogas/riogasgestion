# -*- coding: utf-8 -*-
"""ETL catálogo de estados de móvil → movil_estado.
Interior: PUESTOS.MOVESTADO (MOVESTCOD, MOVESTNOM, MOVESTACT).
Capital:  GXCALDTA.MOVESTAD (MOVESTCOD, MOVESTNOM, MOVESTICA).
Idempotente: DELETE FROM movil_estado antes de insertar."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i


def main():
    a = as400_conn(); ac = a.cursor()

    ac.execute("SELECT MOVESTCOD, MOVESTNOM, MOVESTACT FROM PUESTOS.MOVESTADO")
    interior = [('interior', i(r[0]), s(r[1]), s(r[2])) for r in ac.fetchall()]

    ac.execute("SELECT MOVESTCOD, MOVESTNOM, MOVESTICA FROM GXCALDTA.MOVESTAD")
    capital = [('capital', i(r[0]), s(r[1]), s(r[2])) for r in ac.fetchall()]

    ac.close(); a.close()
    rows = interior + capital
    print(f"leidos estados: interior={len(interior)} capital={len(capital)}")

    p = pg_conn(); pc = p.cursor()
    pc.execute("DELETE FROM movil_estado")
    execute_values(pc,
        'INSERT INTO movil_estado (origen, codigo, nombre, actividad) VALUES %s',
        rows, page_size=500)
    p.commit()

    pc.execute("SELECT count(*) FROM movil_estado"); print("movil_estado:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK estados")


if __name__ == '__main__':
    main()
