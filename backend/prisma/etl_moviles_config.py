# -*- coding: utf-8 -*-
"""ETL de extensión de config de móviles (spec 2026-06-25-front-moviles-detalle-config).

CRÍTICO: UPDATE in-place sobre `movil` (WHERE origen=? AND "idOriginal"=?).
NUNCA delete+insert: un DELETE de movil cascadea y borra
movil_zona/servicio/bodega/stock/ica/horario/punto_recarga/historico.

Trae de AS400 los campos de config que no migró etl_moviles.py:
  Capital  GXCALDTA.MOVILES: enviarPedidosCelular=(MOVENVPEDI='S'), reasignacionPuesto=MOVREASIGN,
           activarDireccionCalleId=MOVCALID, activarDireccionNro=MOVCALNROP,
           coordActivaX=MOVACTENX, coordActivaY=MOVACTENY.
  Interior PUESTOS.MOVILES:  enviarPedidosCelular=(MOVCELACT='S'),
           tiempoCumplimientoServicio=MOVTIEMPOCUMPLSERVICIO.
Además: usaIca=true donde hay fila en movil_ica.
Los campos nuevos de goya (dirSms, mostrarEnMapa, etc.) NO se tocan (quedan en default)."""
from _movhelp import as400_conn, pg_conn, s, i, boolSN

EQUAL_S = ('S', '1', 'Y', 'T')


def dec5(v):
    """MOVACTENX/Y crudo (UTM 21S) → Decimal con 5 decimales; None si 0/vacío."""
    from _movhelp import f
    x = f(v)
    if x is None or x == 0:
        return None
    return round(x, 5)


def main():
    a = as400_conn(); ac = a.cursor()

    # ---------------- Capital ----------------
    ac.execute("""SELECT MOVID, MOVENVPEDI, MOVREASIGN, MOVCALID, MOVCALNROP, MOVACTENX, MOVACTENY
        FROM GXCALDTA.MOVILES""")
    capital = []
    for r in ac.fetchall():
        envped = (s(r[1]) or '').upper() in EQUAL_S
        calid = i(r[3])
        capital.append((
            envped,            # enviarPedidosCelular
            s(r[2])[:2] if s(r[2]) else None,  # reasignacionPuesto
            calid if calid else None,          # activarDireccionCalleId
            i(r[4]),           # activarDireccionNro
            dec5(r[5]),        # coordActivaX
            dec5(r[6]),        # coordActivaY
            i(r[0]),           # idOriginal (MOVID)
        ))

    # ---------------- Interior ----------------
    ac.execute("""SELECT MOVID, MOVCELACT, MOVTIEMPOCUMPLSERVICIO FROM PUESTOS.MOVILES""")
    interior = []
    for r in ac.fetchall():
        envped = (s(r[1]) or '').upper() in EQUAL_S
        interior.append((
            envped,            # enviarPedidosCelular
            i(r[2]),           # tiempoCumplimientoServicio
            i(r[0]),           # idOriginal (MOVID)
        ))
    ac.close(); a.close()
    print(f"leidos config: capital={len(capital)} interior={len(interior)}")

    p = pg_conn(); pc = p.cursor()

    # UPDATE in-place capital
    upd_cap = 0
    for row in capital:
        pc.execute(
            'UPDATE movil SET "enviarPedidosCelular"=%s, "reasignacionPuesto"=%s, '
            '"activarDireccionCalleId"=%s, "activarDireccionNro"=%s, "coordActivaX"=%s, '
            '"coordActivaY"=%s, "updatedAt"=now() WHERE origen=%s AND "idOriginal"=%s',
            (row[0], row[1], row[2], row[3], row[4], row[5], 'capital', row[6]))
        upd_cap += pc.rowcount

    # UPDATE in-place interior
    upd_int = 0
    for row in interior:
        pc.execute(
            'UPDATE movil SET "enviarPedidosCelular"=%s, "tiempoCumplimientoServicio"=%s, '
            '"updatedAt"=now() WHERE origen=%s AND "idOriginal"=%s',
            (row[0], row[1], 'interior', row[2]))
        upd_int += pc.rowcount

    # usaIca: hay fila en movil_ica
    pc.execute('UPDATE movil SET "usaIca"=true '
               'WHERE id IN (SELECT DISTINCT "movilId" FROM movil_ica)')
    upd_ica = pc.rowcount

    p.commit()
    print(f"updates: capital={upd_cap} interior={upd_int} usaIca=true en {upd_ica}")

    # Verificación: counts de sub-dominios NO deben bajar (no hubo cascade).
    for t in ('movil', 'movil_zona', 'movil_servicio', 'movil_bodega', 'movil_stock', 'movil_ica'):
        pc.execute(f'SELECT count(*) FROM {t}')
        print(f"  {t:18} {pc.fetchone()[0]}")
    pc.execute('SELECT count(*) FROM movil WHERE "enviarPedidosCelular" IS NOT NULL')
    print("  movil con enviarPedidosCelular:", pc.fetchone()[0])
    pc.execute('SELECT count(*) FROM movil WHERE "usaIca"=true')
    print("  movil con usaIca=true:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK moviles config")


if __name__ == '__main__':
    main()
