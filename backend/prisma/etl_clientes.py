"""ETL: GXCALDTA.CLIENTE (AS400/DB2) -> goya.public.cliente (Postgres).

Lee por lotes desde el AS400 vía jt400, transforma (fechas YYYYMMDD->date,
vip 0/1->bool, trim de CHAR, ruc->string, descarta AUX) e inserta en goya.
"""
import os
import datetime as dt
from decimal import Decimal, InvalidOperation

os.environ['JAVA_HOME'] = r'C:\Program Files\Java\jdk-21'
import jaydebeapi
import psycopg2
from psycopg2.extras import execute_values

# ── Conexiones (creds desde backend/.env vía _creds, no hardcodeadas) ──────────
from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()
PG = pg_conn_args()

BATCH = 5000

# ── Origen (orden fijo) ─────────────────────────────────────────────────────────
SRC_COLS = [
    "CLIID", "CLINOM", "CLIRUC", "CLIOBS", "CLIMAIL", "CLIESTADO", "CLIGCINRO",
    "CLIVIP", "CLIOBSCOM", "CLIFCHALTA", "CLIFCH", "DIRFCHGEO", "CLIULTLLAM",
    "NROPUERTA", "BIS", "APTO", "BLOCKSOL", "NIVEL", "LOCAL", "NROMANZ", "KM",
    "DIROBS", "CALESQ1ID", "CALESQ2ID", "CALPRINID", "DIRCORX", "DIRCORY",
    "SADCORX", "SADCORY", "SADASIMOVM", "DIRICAX", "DIRICAY", "ICAMET", "ICASRCID",
    "ICASRCOD", "ICAPOSA", "ICASOFDG", "CLITPOPID", "CLIZONA", "CLIRADIO",
    "CLIPEDID", "CLISERVTID", "CLIOPINS", "CLIOPUPD",
]
# ── Destino (mismo orden) ───────────────────────────────────────────────────────
DST_COLS = [
    "id", "nombre", "ruc", "observaciones", "email", "estado", "nroGci",
    "vip", "observacionesComerciales", "fechaAlta", "fecha", "fechaGeolocalizacion",
    "fechaUltimaLlamada", "numeroPuerta", "bis", "apartamento", "blockSolar",
    "nivel", "local", "numeroManzana", "km", "observacionesDireccion",
    "calleEsquina1Id", "calleEsquina2Id", "callePrincipalId", "coordenadaX",
    "coordenadaY", "sadCoordenadaX", "sadCoordenadaY", "sadAsignadoMovil",
    "icaCoordenadaX", "icaCoordenadaY", "icaMetodo", "icaSourceId",
    "icaSourceCodigo", "icaPosA", "icaSofDg", "tipoId", "zona", "radio",
    "ultimoPedidoId", "tipoServicioId", "operadorAlta", "operadorModificacion",
    "createdAt", "updatedAt",
]


# ── Helpers de conversión ────────────────────────────────────────────────────────
def s(v):
    """CHAR -> str sin padding, None si vacío."""
    if v is None:
        return None
    t = str(v).strip()
    return t or None


def i(v):
    if v is None:
        return None
    try:
        t = str(v).strip()
        if t == "":
            return None
        return int(float(t))
    except (ValueError, InvalidOperation):
        return None


def num(v):
    if v is None:
        return None
    try:
        t = str(v).strip()
        if t == "":
            return None
        return Decimal(t)
    except (ValueError, InvalidOperation):
        return None


def ymd(v):
    """CHAR(8) 'YYYYMMDD' -> date. None si inválido/cero/blanco."""
    if v is None:
        return None
    t = str(v).strip()
    if len(t) != 8 or not t.isdigit() or t == "00000000":
        return None
    try:
        return dt.date(int(t[0:4]), int(t[4:6]), int(t[6:8]))
    except ValueError:
        return None


def ts(v):
    """TIMESTMP -> datetime o None."""
    if v is None:
        return None
    if isinstance(v, dt.datetime):
        return v
    t = str(v).strip()
    if not t or t.startswith("0001-") or t.startswith("9999-"):
        return None
    # jt400 puede devolver 'YYYY-MM-DD HH:MM:SS.ffffff' o con guiones/puntos DB2
    for norm in (t, t.replace(".", ":", 2)):
        try:
            return dt.datetime.fromisoformat(norm)
        except ValueError:
            continue
    try:
        d = t[:10].replace(".", "-")
        return dt.datetime.fromisoformat(d)
    except ValueError:
        return None


def transform(r, now):
    (cliid, clinom, cliruc, cliobs, climail, cliestado, cligcinro, clivip,
     cliobscom, clifchalta, clifch, dirfchgeo, cliultllam, nropuerta, bis, apto,
     blocksol, nivel, local_, nromanz, km, dirobs, calesq1, calesq2, calprin,
     dircorx, dircory, sadcorx, sadcory, sadasimovm, diricax, diricay, icamet,
     icasrcid, icasrcod, icaposa, icasofdg, clitpopid, clizona, cliradio,
     clipedid, cliservtid, cliopins, cliopupd) = r

    ruc = i(cliruc)
    vip = None if clivip is None else bool(i(clivip))
    return (
        i(cliid), s(clinom), (str(ruc) if ruc else None), s(cliobs),
        s(climail), s(cliestado), s(cligcinro), vip, s(cliobscom),
        ymd(clifchalta), ymd(clifch), ymd(dirfchgeo), ts(cliultllam),
        i(nropuerta), s(bis), s(apto), s(blocksol), s(nivel), s(local_),
        s(nromanz), num(km), s(dirobs), i(calesq1), i(calesq2), i(calprin),
        num(dircorx), num(dircory), num(sadcorx), num(sadcory), s(sadasimovm),
        num(diricax), num(diricay), i(icamet), i(icasrcid), i(icasrcod),
        num(icaposa), i(icasofdg), i(clitpopid), i(clizona), i(cliradio),
        i(clipedid), i(cliservtid), s(cliopins), s(cliopupd), now, now,
    )


def main():
    print(f"jt400.jar: {AS400_JAR}  existe={os.path.exists(AS400_JAR)}")
    print("Conectando AS400…")
    src = jaydebeapi.connect('com.ibm.as400.access.AS400JDBCDriver',
                             AS400_URL, AS400_PROPS, AS400_JAR)
    scur = src.cursor()
    scur.execute(f"SELECT {', '.join(SRC_COLS)} FROM GXCALDTA.CLIENTE")

    print("Conectando goya…")
    pg = psycopg2.connect(**PG)
    pcur = pg.cursor()
    pcur.execute('TRUNCATE TABLE "cliente"')
    pg.commit()

    cols_sql = ", ".join(f'"{c}"' for c in DST_COLS)
    insert_sql = f'INSERT INTO "cliente" ({cols_sql}) VALUES %s'

    now = dt.datetime.now()
    total = 0
    while True:
        rows = scur.fetchmany(BATCH)
        if not rows:
            break
        vals = [transform(r, now) for r in rows]
        execute_values(pcur, insert_sql, vals, page_size=BATCH)
        pg.commit()
        total += len(vals)
        print(f"  insertados: {total}")

    scur.close(); src.close()
    pcur.execute('SELECT COUNT(*) FROM "cliente"')
    print(f"TOTAL en goya.cliente: {pcur.fetchone()[0]}")
    pcur.close(); pg.close()
    print("✅ ETL completo")


if __name__ == "__main__":
    main()
