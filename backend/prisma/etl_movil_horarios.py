# -*- coding: utf-8 -*-
"""ETL horarios del móvil (capital) → movil_horario + movil_horario_dia + movil_horario_excepcion.
GXCALDTA.MOVHORAR (cabezal, PK MOVID+MOVHORFCHV), MOVHORA1 (detalle por día),
MOVHORA2 (excepciones). Detalle/excepción ligan por (MOVID, MOVHORFCHV).
Idempotente: borra los horarios capital (cascade limpia hijos) antes de insertar."""
from psycopg2.extras import execute_values
from _movhelp import as400_conn, pg_conn, s, i, fecha_yyyymmdd, ts


def cap(v, n):
    t = s(v)
    return t[:n] if t else None


def hhmmss(v):
    d = ts(v)
    return d.strftime('%H:%M:%S') if d else None


def main():
    p = pg_conn(); pc = p.cursor()
    pc.execute("SELECT \"idOriginal\", id FROM movil WHERE origen='capital'")
    mov_map = {int(r[0]): r[1] for r in pc.fetchall()}

    a = as400_conn(); ac = a.cursor()

    # --- Cabezales ---
    ac.execute("""SELECT MOVID, MOVHORFCHV, MOVHORFCHF, MOVHORSDIA, MOVHOROBS, MOVHORUSUA
        FROM GXCALDTA.MOVHORAR""")
    cab = ac.fetchall()
    ac.execute("SELECT MOVID, MOVHORFCHV, DIAID, DIAHORDESD, DIAHORHAST FROM GXCALDTA.MOVHORA1")
    dias = ac.fetchall()
    ac.execute("""SELECT MOVID, MOVHORFCHV, MOVHEHORDE, MOVHEHORHA, MOVHEOBS, MOVHEFCHAL
        FROM GXCALDTA.MOVHORA2""")
    excs = ac.fetchall()
    ac.close(); a.close()

    # idempotencia: borrar horarios capital (hijos por cascade)
    pc.execute("DELETE FROM movil_horario WHERE origen='capital'")
    p.commit()

    # insertar cabezales y mapear (MOVID,MOVHORFCHV) -> horarioId
    cab_rows = []; cab_keys = []; salt = 0
    for r in cab:
        mid = mov_map.get(i(r[0]))
        if mid is None:
            salt += 1; continue
        nrodias = i(r[3])
        cab_rows.append((mid, 'capital', fecha_yyyymmdd(r[1]), fecha_yyyymmdd(r[2]),
                         str(nrodias) if nrodias is not None else None, cap(r[4], 60), cap(r[5], 15)))
        cab_keys.append((i(r[0]), s(r[1])))
    ids = execute_values(pc,
        'INSERT INTO movil_horario ("movilId", origen, "vigenciaDesde", "vigenciaHasta", dias, '
        'observaciones, usuario) VALUES %s RETURNING id', cab_rows, page_size=1000, fetch=True)
    hor_map = {cab_keys[idx]: row[0] for idx, row in enumerate(ids)}
    p.commit()
    print(f"movil_horario: {len(cab_rows)} (saltados {salt})")

    # detalle días
    dia_rows = []; dia_salt = 0
    for r in dias:
        hid = hor_map.get((i(r[0]), s(r[1])))
        if hid is None:
            dia_salt += 1; continue
        dia_rows.append((hid, i(r[2]), hhmmss(r[3]), hhmmss(r[4])))
    execute_values(pc,
        'INSERT INTO movil_horario_dia ("horarioId", "diaId", "horaDesde", "horaHasta") VALUES %s',
        dia_rows, page_size=2000)
    p.commit()
    print(f"movil_horario_dia: {len(dia_rows)} (saltados {dia_salt})")

    # excepciones
    exc_rows = []; exc_salt = 0
    for r in excs:
        hid = hor_map.get((i(r[0]), s(r[1])))
        if hid is None:
            exc_salt += 1; continue
        exc_rows.append((hid, hhmmss(r[2]), hhmmss(r[3]), cap(r[4], 60), ts(r[5])))
    execute_values(pc,
        'INSERT INTO movil_horario_excepcion ("horarioId", "horaDesde", "horaHasta", observaciones, '
        'fecha) VALUES %s', exc_rows, page_size=2000)
    p.commit()
    print(f"movil_horario_excepcion: {len(exc_rows)} (saltados {exc_salt})")

    pc.close(); p.close(); print("OK horarios")


if __name__ == '__main__':
    main()
