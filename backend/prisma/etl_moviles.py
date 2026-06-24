# -*- coding: utf-8 -*-
"""ETL maestro de móviles → movil (interior PUESTOS.MOVILES + capital GXCALDTA.MOVILES).
fleteraId resuelto por (origen, idOriginal=EFLID/MOVEFLID); huérfano → null + log.
destinoId (capital) por (origen, idOriginal=MOVDESTID).
Coords: interior MOVULTCOORDX/Y ya en grados (validar); capital MOVX/Y UTM 21S→WGS84.
Idempotente: DELETE WHERE origen=... por lado (cascade limpia hijos)."""
from psycopg2.extras import execute_values
from _movhelp import (as400_conn, pg_conn, s, i, boolSN, fecha_yyyymmdd, ts,
                      utm_to_latlng, grados_to_latlng)

MONTEVIDEO = 100

COLS = ('origen, "idOriginal", "fleteraId", "puestoId", "estadoCodigo", descripcion, marca, modelo, '
        'matricula, telefono, "capacidadLote", "servicioPrincipal", "tipoServicio", rutea, '
        '"pedidosPendientes", latitud, longitud, "ultimaPosicionAt", "gpsMovilId", "tieneGps", '
        '"gpsReportando", "distanciaMaxMetros", "appPuedeDesactivar", "permiteBajaMomentanea", '
        '"destinoId", "numeroMovil", "activoDesde", "activoHasta", observaciones, "firebaseEnviado", '
        '"firebaseEliminado", "createdAt", "updatedAt"')
TMPL = ('(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'
        'now(),now())')


def cap(v, n):
    t = s(v)
    return t[:n] if t else None


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute('SELECT origen, "idOriginal", id FROM empresa_fletera')
    fletera_map = {(r[0], int(r[1])): r[2] for r in pc.fetchall()}
    pc.execute('SELECT origen, "idOriginal", id FROM movil_destino')
    destino_map = {(r[0], int(r[1])): r[2] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()

    # ---------------- Interior ----------------
    ac.execute("""SELECT MOVID, MOVEFLID, MOVPUESTOID, MOVESTCOD, MOVDSC, MOVDESCRIPCION, MOVMARCA,
        MOVMODELO, MOVMAT, MOVTELFNRO, MOVBOD13TOPE, MOVSERVPRINCIPAL, MOVPEDLOTE, MOVULTCOORDX,
        MOVULTCOORDY, MOVULTMODIFICACION, MOVGPSMOVID, MOVDISTANCIAMAXMTSCUMPPEDIDOS,
        MOVAPPPUEDEDESACTIVAR, MOVPERMITEBAJAMOMENTANEA, MOVNROMOVIL, MOVOBS,
        MOVFIREBASEENVIADO, MOVFIREBASEELIMINADO FROM PUESTOS.MOVILES""")
    interior = []
    huerf_int = []
    for r in ac.fetchall():
        eflid = i(r[1])
        fid = fletera_map.get(('interior', eflid)) if eflid is not None else None
        if eflid is not None and fid is None:
            huerf_int.append((i(r[0]), eflid))
        lat, lng = grados_to_latlng(r[13], r[14])
        descripcion = cap(r[4], 40) or cap(r[5], 40)
        interior.append((
            'interior', i(r[0]), fid, i(r[2]), i(r[3]), descripcion, cap(r[6], 30), cap(r[7], 30),
            cap(r[8], 10), cap(r[9], 30), i(r[10]), cap(r[11], 30), None, None,
            i(r[12]), lat, lng, ts(r[15]), i(r[16]), None,
            None, i(r[17]), boolSN(r[18]), boolSN(r[19]),
            None, i(r[20]), None, None, cap(r[21], 60), ts(r[22]),
            ts(r[23])))

    # ---------------- Capital ----------------
    ac.execute("""SELECT MOVID, EFLID, MOVESTCOD, MOVDSC, MOVMARCA, MOVMODELO, MOVMAT, MOVTELFNRO,
        MOVT1, MOVTPOSERI, MOVRUTEA, MOVPEDPEND, MOVX, MOVY, MOVPOSFCHA, MOVGPS, MOVGPSOK,
        MOVDESTID, MOVACTDESD, MOVACTHAST, MOVOBS FROM GXCALDTA.MOVILES""")
    capital = []
    huerf_cap = []
    for r in ac.fetchall():
        eflid = i(r[1])
        fid = fletera_map.get(('capital', eflid)) if eflid is not None else None
        if eflid is not None and fid is None:
            huerf_cap.append((i(r[0]), eflid))
        lat, lng = utm_to_latlng(r[12], r[13])
        destid = i(r[17])
        did = destino_map.get(('capital', destid)) if destid else None
        tposer = cap(r[9], 10)
        capital.append((
            'capital', i(r[0]), fid, MONTEVIDEO, i(r[2]), cap(r[3], 40), cap(r[4], 30), cap(r[5], 30),
            cap(r[6], 10), cap(r[7], 30), i(r[8]), tposer, tposer, boolSN(r[10]),
            i(r[11]), lat, lng, ts(r[14]), None, boolSN(r[15]),
            boolSN(r[16]), None, None, None,
            did, None, fecha_yyyymmdd(r[18]), fecha_yyyymmdd(r[19]), cap(r[20], 60), None,
            None))
    ac.close(); a.close()
    print(f"leidos moviles: interior={len(interior)} capital={len(capital)}")
    print(f"  huerfanos fletera interior={len(huerf_int)} capital={len(huerf_cap)}")
    for h in huerf_int: print("   [INT huerfano MOVEFLID]", h)
    for h in huerf_cap: print("   [CAP huerfano EFLID]", h)

    pc.execute("DELETE FROM movil WHERE origen='interior'")
    pc.execute("DELETE FROM movil WHERE origen='capital'")
    execute_values(pc, f'INSERT INTO movil ({COLS}) VALUES %s',
                   interior + capital, template=TMPL, page_size=1000)
    p.commit()

    pc.execute("SELECT count(*) FROM movil"); print("movil total:", pc.fetchone()[0])
    pc.execute("SELECT origen, count(*) FROM movil GROUP BY origen ORDER BY origen")
    for r in pc.fetchall(): print("  ", r[0], r[1])
    pc.execute('SELECT count(*) FROM movil WHERE "fleteraId" IS NULL'); print("  fleteraId null:", pc.fetchone()[0])
    pc.execute("SELECT count(*) FROM movil WHERE origen='capital' AND latitud BETWEEN -35.5 AND -30")
    print("  capital con coords en rango UY:", pc.fetchone()[0])
    pc.close(); p.close(); print("OK moviles")


if __name__ == '__main__':
    main()
