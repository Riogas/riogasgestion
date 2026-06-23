# -*- coding: utf-8 -*-
"""Backfill de verificación de coordenadas / geoinversa de clientes (goya).

Por cada cliente con GPS: normaliza coords (SAD→ICA→DIRCOR a WGS84), geoinversa
contra el Nominatim propio, reconstruye `direccion`, y marca calleMatch (✅/❌)
comparando la calle de la geoinversa con la que el cliente tenía (catálogo `calle`).

Re-ejecutable / idempotente. Por defecto procesa solo los no verificados.

Uso:
  python backfill_geo.py --limit 50              # muestra de validación
  python backfill_geo.py                          # todos los pendientes
  python backfill_geo.py --todos                  # re-verifica todos (ignora geoVerificadoAt)
  NOMINATIM_URL=http://nominatim.riogas.uy python backfill_geo.py --workers 16
"""
import argparse
import os
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import psycopg2
from psycopg2.extras import execute_values
import requests
from pyproj import Transformer
from rapidfuzz import fuzz

from _creds import pg_conn_args

NOMINATIM = os.environ.get("NOMINATIM_URL", "http://nominatim.riogas.uy").rstrip("/")

PG = pg_conn_args()

T_UTM = Transformer.from_crs(32721, 4326, always_xy=True)  # WGS84 / UTM 21S -> WGS84
UY_LAT = (-35.5, -30.0)
UY_LON = (-59.0, -53.0)

PREFIJOS = re.compile(r"\b(calle|av|avda|avenida|dr|dra|gral|cno|camino|bvar|bulevar|"
                      r"pasaje|pje|ruta|ramal|cont|continuacion|tte|cnel|ing|pte)\b")


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def in_uy(lat, lon):
    return lat is not None and lon is not None and UY_LAT[0] <= lat <= UY_LAT[1] and UY_LON[0] <= lon <= UY_LON[1]


def normalizar_coord(sadx, sady, icax, icay, dirx, diry):
    """Devuelve (lat, lon, fuente) en WGS84, o None."""
    sx, sy = f(sadx), f(sady)
    if sx and sy and in_uy(sx, sy):           # SAD: X=lat, Y=lon
        return sx, sy, "sad"
    ix, iy = f(icax), f(icay)
    if ix and iy:                              # ICA: UTM 21S
        lon, lat = T_UTM.transform(ix, iy)
        if in_uy(lat, lon):
            return lat, lon, "ica"
    dx, dy = f(dirx), f(diry)
    if dx and dy:                              # DIRCOR: mezcla
        if abs(dx) < 90:                       #   lat/lng (X=lat, Y=lon)
            lat, lon = dx, dy
        else:                                  #   UTM 21S
            lon, lat = T_UTM.transform(dx, dy)
        if in_uy(lat, lon):
            return lat, lon, "dircor"
    return None


def norm_calle(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)             # quitar "(PROGRESO)" etc.
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = PREFIJOS.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def match_calle(vieja, geo):
    """(bool, score). Sin calle vieja -> verde (regla del usuario)."""
    o, g = norm_calle(vieja), norm_calle(geo)
    if not o:
        return True, 1.0
    if not g:
        return False, 0.0
    if o == g:
        return True, 1.0
    if (o in g or g in o) and min(len(o), len(g)) >= 4:
        return True, 0.95
    r = fuzz.token_sort_ratio(o, g) / 100.0
    return (r >= 0.85), round(r, 3)


def reverse(session, lat, lon):
    params = dict(format="jsonv2", lat=lat, lon=lon, addressdetails=1, zoom=18)
    for i in range(3):
        try:
            r = session.get(f"{NOMINATIM}/reverse", params=params, timeout=25)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        time.sleep(0.4 * (i + 1))
    return None


def construir_direccion(calle, nro, bis, esq1, esq2, solar, mz, apto, km, localidad):
    partes = []
    base = (calle or "").strip()
    if nro:
        base = (base + " " + str(nro)).strip()
    if bis:
        base = (base + " " + str(bis)).strip()
    if base:
        partes.append(base)
    esquinas = [e for e in (esq1, esq2) if e]
    if esquinas:
        partes.append("esq. " + " y ".join(esquinas))
    if solar:
        partes.append("Solar " + str(solar))
    if mz:
        partes.append("Mz " + str(mz))
    if apto:
        partes.append("Apto " + str(apto))
    if km:
        partes.append("Km " + str(km))
    if localidad:
        partes.append(localidad)
    return ", ".join(partes)[:300] or None


def procesar_cliente(session, row, calles):
    (cid, sadx, sady, icax, icay, dirx, diry,
     calprin, esq1id, esq2id, nro, bis, solar, mz, apto, km) = row
    coord = normalizar_coord(sadx, sady, icax, icay, dirx, diry)
    if not coord:
        return None  # sin GPS usable
    lat, lon, fuente = coord
    data = reverse(session, lat, lon)
    addr = (data or {}).get("address", {}) or {}
    calle_geo = addr.get("road") or addr.get("pedestrian") or addr.get("residential")
    nro_geo = addr.get("house_number")
    localidad = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("suburb")
    depto = addr.get("state")
    cp = addr.get("postcode")

    def cap(s, n):
        return s[:n] if isinstance(s, str) else s
    calle_geo = cap(calle_geo, 150)
    nro_geo = cap(nro_geo, 30)
    localidad = cap(localidad, 120)
    depto = cap(depto, 120)
    cp = cap(cp, 20)

    calle_vieja = calles.get(calprin)
    e1, e2 = calles.get(esq1id), calles.get(esq2id)
    es_match, score = match_calle(calle_vieja, calle_geo)

    # direccion: prioriza componentes viejos resueltos; cae a la geoinversa
    direccion = construir_direccion(calle_vieja or calle_geo, nro or nro_geo, bis,
                                    e1, e2, solar, mz, apto, km, localidad)
    return (cid, direccion, calle_geo, nro_geo, localidad, depto, cp,
            es_match, score, round(lat, 7), round(lon, 7), fuente)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--batch", type=int, default=2000)
    ap.add_argument("--todos", action="store_true", help="re-verifica todos (ignora geoVerificadoAt)")
    args = ap.parse_args()

    conn = psycopg2.connect(**PG)
    cur = conn.cursor()
    cur.execute('SELECT id, nombre FROM calle')
    calles = {r[0]: r[1] for r in cur.fetchall()}
    print(f"Catálogo: {len(calles)} calles")

    where = ('("sadCoordenadaX" IS NOT NULL OR "icaCoordenadaX" IS NOT NULL OR "coordenadaX" IS NOT NULL)')
    if not args.todos:
        where += ' AND "geoVerificadoAt" IS NULL'
    limit = f" LIMIT {args.limit}" if args.limit else ""
    sql = (f'SELECT id, "sadCoordenadaX","sadCoordenadaY","icaCoordenadaX","icaCoordenadaY",'
           f'"coordenadaX","coordenadaY","callePrincipalId","calleEsquina1Id","calleEsquina2Id",'
           f'"numeroPuerta",bis,"blockSolar","numeroManzana",apartamento,km '
           f'FROM cliente WHERE {where} ORDER BY id{limit}')
    cur.execute(sql)
    rows = cur.fetchall()
    total = len(rows)
    print(f"A procesar: {total:,} clientes  | Nominatim: {NOMINATIM} | workers {args.workers}")

    session = requests.Session()
    procesados = ok = err = verdes = rojos = 0
    t0 = time.time()
    upd_sql = (
        'UPDATE cliente AS c SET '
        '"direccion"=v.direccion, "calleGeo"=v.callegeo, "numeroPuertaGeo"=v.nrogeo,'
        '"localidadGeo"=v.loc, "departamentoGeo"=v.depto, "cpGeo"=v.cp,'
        '"calleMatch"=v.match, "matchScore"=v.score, "geoLat"=v.lat, "geoLng"=v.lng,'
        '"geoFuente"=v.fuente, "geoVerificadoAt"=NOW() '
        'FROM (VALUES %s) AS v(id,direccion,callegeo,nrogeo,loc,depto,cp,match,score,lat,lng,fuente) '
        'WHERE c.id=v.id')

    for i in range(0, total, args.batch):
        chunk = rows[i:i + args.batch]
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            res = list(ex.map(lambda r: procesar_cliente(session, r, calles), chunk))
        updates = [x for x in res if x]
        if updates:
            execute_values(cur, upd_sql, updates,
                           template='(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', page_size=1000)
            conn.commit()
        procesados += len(chunk)
        ok += len(updates)
        verdes += sum(1 for u in updates if u[7])
        rojos += sum(1 for u in updates if u[7] is False)
        rate = procesados / max(time.time() - t0, 0.01)
        eta = (total - procesados) / max(rate, 0.01) / 60
        print(f"  {procesados:,}/{total:,}  ok={ok:,} verde={verdes:,} rojo={rojos:,}  "
              f"{rate:.1f}/s  ETA {eta:.0f}min", flush=True)

    cur.close(); conn.close()
    print(f"FIN. procesados={procesados:,} actualizados={ok:,} verde={verdes:,} rojo={rojos:,} "
          f"en {(time.time()-t0)/60:.1f}min")


if __name__ == "__main__":
    main()
