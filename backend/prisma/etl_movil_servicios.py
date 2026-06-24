# -*- coding: utf-8 -*-
"""ETL servicios que presta cada móvil (capital) → movil_servicio.
GXCALDTA.MOVSERV (MOVID, MOVSERID). servicioId resuelto por (origen='capital', idOriginal=MOVSERID).
Idempotente por origen='capital'."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, i


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute("SELECT \"idOriginal\", id FROM movil WHERE origen='capital'")
    mov_map = {int(r[0]): r[1] for r in pc.fetchall()}
    pc.execute("SELECT \"idOriginal\", id FROM servicio WHERE origen='capital'")
    serv_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()
    ac.execute("SELECT MOVID, MOVSERID FROM GXCALDTA.MOVSERV")
    rows = []; saltados = 0; serv_no_cat = set()
    for r in ac.fetchall():
        mid = mov_map.get(i(r[0]))
        if mid is None:
            saltados += 1; continue
        serid = i(r[1])
        sid = serv_map.get(serid)
        if serid is not None and sid is None:
            serv_no_cat.add(serid)
        rows.append((mid, 'capital', sid))
    ac.close(); a.close()
    print(f"leidos MOVSERV: {len(rows)+saltados} (saltados sin movil: {saltados})")
    if serv_no_cat:
        print("  MOVSERID sin catalogo (servicioId=null):", sorted(serv_no_cat))

    pc.execute("DELETE FROM movil_servicio WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_servicio ("movilId", origen, "servicioId") VALUES %s',
        rows, page_size=3000)
    p.commit()
    pc.execute("SELECT count(*) FROM movil_servicio WHERE origen='capital'"); print("movil_servicio:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK servicios-movil")


if __name__ == '__main__':
    main()
