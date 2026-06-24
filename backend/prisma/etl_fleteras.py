# -*- coding: utf-8 -*-
"""ETL empresas fleteras → empresa_fletera.
Interior: PUESTOS.EFLETERA (puestoId=EFLPUESTOID real).
Capital:  GXCALDTA.EFLETERA (puestoId=100, baseOperativa=EFLUSER, direccion=calle[EFLCALID]+EFLNROPUER).
Idempotente: DELETE WHERE origen=... por lado antes de insertar."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i

MONTEVIDEO = 100


def cap(v, n):
    t = s(v)
    return t[:n] if t else None


def main():
    p = pg_conn(); pc = p.cursor()
    # mapa calle CALID → nombre (para resolver direccion capital)
    pc.execute("SELECT id, nombre FROM calle")
    calle_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()

    # --- Interior ---
    ac.execute("""SELECT EFLID, EFLPUESTOID, EFLNOM, EFLRAZONSOCIAL, EFLDIRECCION,
        EFLTEL, EFLMAIL, EFLRUC, EFLESTADO, EFLOBS, EFLGPSEFLETERA FROM PUESTOS.EFLETERA""")
    interior = []
    for r in ac.fetchall():
        interior.append(('interior', i(r[0]), i(r[1]), None, cap(r[2], 80), None,
                         cap(r[3], 80), cap(r[4], 120), cap(r[5], 60), cap(r[6], 60),
                         s(r[7]) if i(r[7]) else None, cap(r[8], 1), cap(r[9], 60), i(r[10])))

    # --- Capital ---
    ac.execute("""SELECT EFLID, EFLNOM, EFLNOMCOMO, EFLRUC, EFLTEL, EFLMAIL, EFLESTADO,
        EFLOBS, EFLUSER, EFLCALID, EFLNROPUER FROM GXCALDTA.EFLETERA""")
    capital = []
    for r in ac.fetchall():
        calid = i(r[9]); nro = i(r[10])
        calle_nom = calle_map.get(calid) if calid else None
        if calle_nom:
            direccion = (calle_nom + (' ' + str(nro) if nro else '')).strip()
        elif calid:
            direccion = f"calle#{calid}" + (' ' + str(nro) if nro else '')
        else:
            direccion = None
        capital.append(('capital', i(r[0]), MONTEVIDEO, s(r[8]), cap(r[1], 80),
                        cap(r[2], 40), None, cap(direccion, 120), cap(r[4], 60),
                        cap(r[5], 60), s(r[3]) if i(r[3]) else None, cap(r[6], 1),
                        cap(r[7], 60), None))
    ac.close(); a.close()
    print(f"leidos fleteras: interior={len(interior)} capital={len(capital)}")

    cols = ('origen, "idOriginal", "puestoId", "baseOperativa", nombre, "nombreComercial", '
            '"razonSocial", direccion, telefono, email, ruc, estado, observaciones, "gpsId", '
            '"createdAt", "updatedAt"')
    tmpl = '(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())'

    pc.execute("DELETE FROM empresa_fletera WHERE origen='interior'")
    pc.execute("DELETE FROM empresa_fletera WHERE origen='capital'")
    execute_values(pc, f'INSERT INTO empresa_fletera ({cols}) VALUES %s',
                   interior + capital, template=tmpl, page_size=1000)
    p.commit()

    pc.execute("SELECT count(*) FROM empresa_fletera"); print("empresa_fletera:", pc.fetchone()[0])
    pc.execute("SELECT origen, count(*) FROM empresa_fletera GROUP BY origen ORDER BY origen")
    for r in pc.fetchall(): print("  ", r[0], r[1])
    pc.close(); p.close(); print("OK fleteras")


if __name__ == '__main__':
    main()
