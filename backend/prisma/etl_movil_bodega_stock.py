# -*- coding: utf-8 -*-
"""ETL bodega + stock por móvil (capital) → movil_bodega, movil_stock.
GXCALDTA.MOVBODEG (capacidad por producto) y GXCALDTA.MOVSTOCK (stock a bordo).
Idempotente por origen='capital'."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i, ts


def cap(v, n):
    t = s(v)
    return t[:n] if t else None


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute("SELECT \"idOriginal\", id FROM movil WHERE origen='capital'")
    mov_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()

    # --- Bodega ---
    ac.execute("SELECT MOVID, MOVPRODEMP, MOVPRODCOD, MOVBODEGA, MOVBODSINA, MOVBODFCH FROM GXCALDTA.MOVBODEG")
    bod = []; bod_salt = 0
    for r in ac.fetchall():
        mid = mov_map.get(i(r[0]))
        if mid is None:
            bod_salt += 1; continue
        bod.append((mid, 'capital', cap(r[1], 4), cap(r[2], 15), i(r[3]), i(r[4]), ts(r[5])))

    # --- Stock ---
    ac.execute("""SELECT MOVID, MOVPRDEMPC, MOVPRDCOD, MOVPRDSTKM, MOVPRDSTKO, MOVPRDTIEC,
        MOVPRDTIED FROM GXCALDTA.MOVSTOCK""")
    stk = []; stk_salt = 0
    for r in ac.fetchall():
        mid = mov_map.get(i(r[0]))
        if mid is None:
            stk_salt += 1; continue
        stk.append((mid, 'capital', cap(r[1], 4), cap(r[2], 15), i(r[3]), i(r[4]), i(r[5]), i(r[6])))
    ac.close(); a.close()
    print(f"leidos MOVBODEG: {len(bod)+bod_salt} (saltados {bod_salt}) | MOVSTOCK: {len(stk)+stk_salt} (saltados {stk_salt})")

    pc.execute("DELETE FROM movil_bodega WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_bodega ("movilId", origen, "productoEmpresa", "productoCodigo", '
        'capacidad, "sinActivar", fecha) VALUES %s', bod, page_size=2000)
    pc.execute("DELETE FROM movil_stock WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_stock ("movilId", origen, "productoEmpresa", "productoCodigo", '
        '"stockMovil", "stockOcupado", "tiempoCarga", "tiempoDescarga") VALUES %s', stk, page_size=2000)
    p.commit()
    pc.execute("SELECT count(*) FROM movil_bodega WHERE origen='capital'"); print("movil_bodega:", pc.fetchone()[0])
    pc.execute("SELECT count(*) FROM movil_stock WHERE origen='capital'"); print("movil_stock:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK bodega/stock")


if __name__ == '__main__':
    main()
