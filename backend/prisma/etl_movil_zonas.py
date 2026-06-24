# -*- coding: utf-8 -*-
"""ETL zonas que cubre cada móvil (capital) → movil_zona.
GXCALDTA.MOVZONAS (MOVID, ESCID, ESCCANALID, ESCZONAID, ESCZONTPO, ESCZONFLAG).
zonaId sin FK dura (id-space a confirmar). Idempotente por origen='capital'."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, i


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute("SELECT \"idOriginal\", id FROM movil WHERE origen='capital'")
    mov_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()
    ac.execute("SELECT MOVID, ESCID, ESCCANALID, ESCZONAID, ESCZONTPO, ESCZONFLAG FROM GXCALDTA.MOVZONAS")
    rows = []; saltados = 0
    for r in ac.fetchall():
        mid = mov_map.get(i(r[0]))
        if mid is None:
            saltados += 1; continue
        flag = i(r[5])
        rows.append((mid, 'capital', i(r[1]), i(r[2]), i(r[3]), i(r[4]),
                     str(flag) if flag is not None else None))
    ac.close(); a.close()
    print(f"leidos MOVZONAS: {len(rows)+saltados} (saltados sin movil: {saltados})")

    pc.execute("DELETE FROM movil_zona WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_zona ("movilId", origen, "escenarioId", "canalId", "zonaId", tipo, flag) VALUES %s',
        rows, page_size=2000)
    p.commit()
    pc.execute("SELECT count(*) FROM movil_zona WHERE origen='capital'"); print("movil_zona:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK zonas")


if __name__ == '__main__':
    main()
