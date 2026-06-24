# -*- coding: utf-8 -*-
"""ETL destinos de móvil (solo capital) → movil_destino.
GXCALDTA.MOVDESTI (MOVDESTID, MOVDESTNOM, MOVDESTX/Y UTM 21S→WGS84, MOVDESTOBS).
Idempotente: DELETE WHERE origen='capital' antes de insertar."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i, utm_to_latlng


def main():
    a = as400_conn(); ac = a.cursor()
    ac.execute("SELECT MOVDESTID, MOVDESTNOM, MOVDESTX, MOVDESTY, MOVDESTOBS FROM GXCALDTA.MOVDESTI")
    rows = []
    fuera = 0
    for r in ac.fetchall():
        lat, lng = utm_to_latlng(r[2], r[3])
        if (r[2] or r[3]) and lat is None:
            fuera += 1
        obs = s(r[4])
        rows.append(('capital', i(r[0]), s(r[1]), lat, lng, obs[:120] if obs else None))
    ac.close(); a.close()
    print(f"leidos MOVDESTI: {len(rows)} (coords fuera de rango UY -> null: {fuera})")

    p = pg_conn(); pc = p.cursor()
    pc.execute("DELETE FROM movil_destino WHERE origen='capital'")
    execute_values(pc,
        'INSERT INTO movil_destino (origen, "idOriginal", nombre, latitud, longitud, direccion) VALUES %s',
        rows, page_size=1000)
    p.commit()

    pc.execute("SELECT count(*) FROM movil_destino WHERE origen='capital'")
    print("movil_destino:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK destinos")


if __name__ == '__main__':
    main()
