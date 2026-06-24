# -*- coding: utf-8 -*-
"""ETL relación móvil ↔ distribuidor ICA (capital) → movil_ica.
GXCALDTA.MOVICAMO (MOVID, DISTID). Idempotente por origen='capital'."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, i


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute("SELECT \"idOriginal\", id FROM movil WHERE origen='capital'")
    mov_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()
    ac.execute("SELECT MOVID, DISTID FROM GXCALDTA.MOVICAMO")
    rows = []; saltados = 0
    for r in ac.fetchall():
        mid = mov_map.get(i(r[0]))
        if mid is None:
            saltados += 1; continue
        rows.append((mid, 'capital', i(r[1])))
    ac.close(); a.close()
    print(f"leidos MOVICAMO: {len(rows)+saltados} (saltados sin movil: {saltados})")

    pc.execute("DELETE FROM movil_ica WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_ica ("movilId", origen, "distribuidorId") VALUES %s', rows, page_size=2000)
    p.commit()
    pc.execute("SELECT count(*) FROM movil_ica WHERE origen='capital'"); print("movil_ica:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK ica")


if __name__ == '__main__':
    main()
