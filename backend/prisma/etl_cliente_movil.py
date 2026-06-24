# -*- coding: utf-8 -*-
"""ETL cliente ↔ móvil preferido (capital) → cliente_movil.
GXCALDTA.CLIMOVIL (CLIID, CLIMOVID, CLIMOVPRIO).
clienteId resuelto por cliente_uni(origen='capital', idOriginal=CLIID); CLIID=0 → null.
movilId resuelto por movil(origen='capital', idOriginal=CLIMOVID); sin móvil → saltar + log.
Idempotente por origen='capital'."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, i


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute("SELECT \"idOriginal\", id FROM movil WHERE origen='capital'")
    mov_map = {int(r[0]): r[1] for r in pc.fetchall()}
    pc.execute("SELECT \"idOriginal\", id FROM cliente_uni WHERE origen='capital'")
    cli_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()
    ac.execute("SELECT CLIID, CLIMOVID, CLIMOVPRIO FROM GXCALDTA.CLIMOVIL")
    rows = []; salt_mov = 0; cli_null = 0; cli_no_res = 0
    for r in ac.fetchall():
        movid = i(r[1])
        mid = mov_map.get(movid)
        if mid is None:
            salt_mov += 1; continue
        cliid = i(r[0])
        if not cliid:                       # CLIID=0 → genérico
            clid = None; cli_null += 1
        else:
            clid = cli_map.get(cliid)
            if clid is None:
                cli_no_res += 1             # CLIID no resuelve en cliente_uni → null
        rows.append((clid, mid, 'capital', i(r[2])))
    ac.close(); a.close()
    print(f"leidos CLIMOVIL: {len(rows)+salt_mov} | insertados {len(rows)} "
          f"(saltados sin movil {salt_mov}; clienteId null: CLIID=0 {cli_null}, no resuelto {cli_no_res})")

    pc.execute("DELETE FROM cliente_movil WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO cliente_movil ("clienteId", "movilId", origen, prioridad) VALUES %s',
        rows, page_size=2000)
    p.commit()
    pc.execute("SELECT count(*) FROM cliente_movil WHERE origen='capital'"); print("cliente_movil:", pc.fetchone()[0])
    pc.execute("SELECT count(*) FROM cliente_movil WHERE \"clienteId\" IS NOT NULL")
    print("  con clienteId resuelto:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK cliente_movil")


if __name__ == '__main__':
    main()
