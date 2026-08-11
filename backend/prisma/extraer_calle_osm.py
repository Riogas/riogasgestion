# -*- coding: utf-8 -*-
"""Extracción del catálogo de calles desde el OSM propio -> goya.calle_osm.

Por departamento: Overpass trae los ways con highway+name (tags + center),
se clusterizan por (nombre normalizado, proximidad) — los tramos de una misma
calle colapsan a UNA fila; dos pueblos con la misma calle quedan separados —
y la localidad de cada cluster sale de una geoinversa al centroide contra
el Nominatim propio.

Uso:  python extraer_calle_osm.py [--solo-depto Montevideo] [--sin-localidad]
"""
import argparse
import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8')

import psycopg2
import requests
from psycopg2.extras import execute_values

from _creds import pg_conn_args
from _normcalle import normalizar_calle, normalizar_lugar

OVERPASS = 'http://overpass.riogas.uy/api/interpreter'
NOMINATIM = 'http://nominatim.riogas.uy'
PG = pg_conn_args()

DEPARTAMENTOS = [
    'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores',
    'Florida', 'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú',
    'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José', 'Soriano',
    'Tacuarembó', 'Treinta y Tres',
]

# GOTCHA (2026-08-11): NO usar area["admin_level"="4"] de Overpass para
# recortar por departamento. Tras aplicar diffs, las áreas tocadas quedan
# pendientes de regeneración por horas y esos departamentos devuelven 0 ways
# (pasó con Florida/Paysandú/Salto/Durazno). Nuestro Overpass solo contiene
# Uruguay, así que se consulta TODO el país sin área y el departamento sale
# de la misma geoinversa que ya se hace por cluster.

# Tramos de la misma calle a menos de este radio se consideran la misma calle
# (encadenado: una avenida larga queda unida por sus tramos consecutivos).
RADIO_CLUSTER_KM = 2.0
VARIANTES_TAGS = [('old_name', 'old'), ('alt_name', 'alt'),
                  ('short_name', 'short'), ('official_name', 'official')]


def hav_km(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + \
        math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


PASO_MUESTREO_KM = 0.12  # un punto cada ~120 m a lo largo de la geometría


def _muestrear(geom: list[dict]) -> list[tuple[float, float]]:
    """Puntos cada ~120 m A LO LARGO del way, extremos incluidos.

    Muestrear solo el centro del way (out center) rompe con las calles
    largas: 'Doctor Roberto Berro' son 2 ways de ~500 m -> 2 puntos, y los
    clientes a lo largo quedaban a >150 m de ambos, con lo que la nube 'caía'
    sobre la paralela cortada en tramos cortos (incidente 2026-08-11)."""
    puntos = [(g['lat'], g['lon']) for g in geom if g]
    if len(puntos) < 2:
        return puntos
    salida = [puntos[0]]
    acumulado = 0.0
    for a, b in zip(puntos, puntos[1:]):
        d = hav_km(a, b)
        acumulado += d
        if acumulado >= PASO_MUESTREO_KM:
            salida.append(b)
            acumulado = 0.0
    if salida[-1] != puntos[-1]:
        salida.append(puntos[-1])
    return salida


def ways_del_pais() -> list[dict]:
    """Todos los ways con highway+name del país, con su geometría (la base
    ES Uruguay). `out geom` pesa más que `out center` pero es lo que permite
    el muestreo denso; el Overpass es propio y local."""
    q = '[out:json][timeout:600];way["highway"]["name"];out tags geom;'
    r = requests.post(OVERPASS, data={'data': q}, timeout=900)
    r.raise_for_status()
    out = []
    for e in r.json().get('elements', []):
        geom = e.get('geometry')
        tags = e.get('tags', {})
        if not geom or not tags.get('name'):
            continue
        muestras = _muestrear(geom)
        if not muestras:
            continue
        lat = sum(p[0] for p in muestras) / len(muestras)
        lng = sum(p[1] for p in muestras) / len(muestras)
        out.append({'id': e['id'], 'lat': lat, 'lng': lng,
                    'muestras': muestras, 'tags': tags})
    return out


def clusterizar(ways: list[dict]) -> list[dict]:
    """Single-linkage por nombre normalizado + proximidad encadenada."""
    por_nombre: dict[str, list[dict]] = {}
    for w in ways:
        norm = normalizar_calle(w['tags']['name'])
        if not norm:
            continue
        por_nombre.setdefault(norm, []).append(w)

    clusters = []
    for norm, grupo in por_nombre.items():
        # union-find chico (los grupos son de decenas, no miles)
        padre = list(range(len(grupo)))

        def find(i):
            while padre[i] != i:
                padre[i] = padre[padre[i]]
                i = padre[i]
            return i

        for i in range(len(grupo)):
            for j in range(i + 1, len(grupo)):
                if find(i) != find(j) and hav_km(
                    (grupo[i]['lat'], grupo[i]['lng']),
                    (grupo[j]['lat'], grupo[j]['lng']),
                ) <= RADIO_CLUSTER_KM:
                    padre[find(j)] = find(i)

        grupos: dict[int, list[dict]] = {}
        for i, w in enumerate(grupo):
            grupos.setdefault(find(i), []).append(w)

        for miembros in grupos.values():
            nombres = {}
            variantes = {}
            tipos = {}
            for w in miembros:
                t = w['tags']
                nombres[t['name']] = nombres.get(t['name'], 0) + 1
                tipos[t.get('highway', '')] = tipos.get(t.get('highway', ''), 0) + 1
                for tag, tipo in VARIANTES_TAGS:
                    if t.get(tag):
                        for v in t[tag].split(';'):
                            v = v.strip()
                            if v:
                                variantes[(tipo, v)] = True
            canonico = max(nombres, key=nombres.get)
            lats = [w['lat'] for w in miembros]
            lngs = [w['lng'] for w in miembros]
            # Muestras densas de TODOS los ways del cluster (tope 250: una
            # avenida de 20 km no necesita más para la pasada geométrica).
            puntos = [
                [round(la, 6), round(lo, 6)]
                for w in miembros for la, lo in w.get('muestras', [(w['lat'], w['lng'])])
            ][:250]
            clusters.append({
                'nombre': canonico,
                'nombreNorm': norm,
                'lat': round(sum(lats) / len(lats), 7),
                'lng': round(sum(lngs) / len(lngs), 7),
                'puntos': puntos,
                'wayIds': [w['id'] for w in miembros],
                'tipoVia': max(tipos, key=tipos.get) or None,
                'variantes': [
                    {'tipo': tipo, 'nombre': v} for (tipo, v) in variantes
                ] or None,
            })
    return clusters


def poligonos_departamentos() -> list[tuple[str, object]]:
    """Los límites de los 19 departamentos desde Overpass, como polígonos
    shapely. Fallback para cuando el reverse de Nominatim no trae `state`
    (pasa con Colonia: su límite está roto en el import de Nominatim)."""
    from shapely.geometry import LineString, Point  # noqa: F401
    from shapely.ops import polygonize, unary_union

    q = ('[out:json][timeout:120];'
         'relation["boundary"="administrative"]["admin_level"="4"];out geom;')
    r = requests.post(OVERPASS, data={'data': q}, timeout=180)
    r.raise_for_status()
    salida = []
    for rel in r.json().get('elements', []):
        nombre = rel.get('tags', {}).get('name')
        # El extracto trae provincias argentinas fronterizas (Buenos Aires,
        # Entre Ríos) con admin_level 4: solo los 19 departamentos nuestros.
        if not nombre or nombre not in DEPARTAMENTOS:
            continue
        lineas = []
        for m in rel.get('members', []):
            geom = m.get('geometry')
            if m.get('type') != 'way' or not geom:
                continue
            # Overpass emite entradas null dentro de geometry: filtrarlas.
            puntos = [(g['lon'], g['lat']) for g in geom if g]
            if len(puntos) >= 2:
                lineas.append(LineString(puntos))
        if not lineas:
            continue
        try:
            poligonos = list(polygonize(unary_union(lineas)))
        except Exception:
            continue
        if poligonos:
            salida.append((nombre, unary_union(poligonos)))
    return salida


def lugar_de(lat: float, lng: float, sesion: requests.Session) -> tuple[str | None, str | None]:
    """(localidad, departamento) del punto. Zoom 13 = localidad; si es campo
    abierto (caminos rurales), zoom 10 da el municipio. El departamento viene
    como `state` en la misma respuesta."""
    depto = None
    for zoom in (13, 10):
        try:
            r = sesion.get(
                f'{NOMINATIM}/reverse',
                params={'lat': lat, 'lon': lng, 'format': 'jsonv2', 'zoom': zoom,
                        'addressdetails': 1},
                timeout=12,
            )
            if not r.ok:
                continue
            a = r.json().get('address', {})
            depto = depto or a.get('state')
            loc = (a.get('city') or a.get('town') or a.get('village')
                   or a.get('hamlet') or a.get('municipality'))
            if loc:
                return loc, depto
        except requests.RequestException:
            continue
    return None, depto


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sin-localidad', action='store_true')
    args = ap.parse_args()

    t0 = time.time()
    ways = ways_del_pais()
    print(f'país: {len(ways)} ways con nombre')
    todos = clusterizar(ways)
    print(f'clusters: {len(todos)}')

    # Localidad Y departamento por geoinversa del centroide de cada cluster.
    if not args.sin_localidad:
        print(f'Geoinversa para {len(todos)} clusters...')
        with requests.Session() as ses, ThreadPoolExecutor(max_workers=12) as ex:
            resultados = list(ex.map(
                lambda c: lugar_de(c['lat'], c['lng'], ses), todos))
        for c, (loc, depto) in zip(todos, resultados):
            c['localidad'] = loc
            c['departamento'] = depto
    else:
        for c in todos:
            c['localidad'] = None
            c['departamento'] = None

    # Fallback: point-in-polygon con los límites de Overpass para los que el
    # reverse no supo ubicar (el límite de Colonia está roto en Nominatim).
    pendientes = [c for c in todos if not c['departamento']]
    if pendientes:
        print(f'PIP para {len(pendientes)} clusters sin depto...')
        from shapely.geometry import Point
        try:
            deptos_poly = poligonos_departamentos()
        except Exception as e:
            print(f'  no se pudieron bajar los límites: {e}')
            deptos_poly = []
        resueltos = 0
        for c in pendientes:
            punto = Point(c['lng'], c['lat'])
            for nombre, poly in deptos_poly:
                if poly.contains(punto):
                    c['departamento'] = nombre
                    resueltos += 1
                    break
        print(f'  resueltos por PIP: {resueltos}')

    sin_depto = sum(1 for c in todos if not c['departamento'])
    todos = [c for c in todos if c['departamento']]
    print(f'TOTAL: {len(todos)} calles ({sin_depto} sin depto, descartadas) '
          f'en {time.time()-t0:.0f}s')

    p = psycopg2.connect(**PG)
    pc = p.cursor()
    pc.execute('TRUNCATE TABLE calle_osm RESTART IDENTITY CASCADE')
    execute_values(
        pc,
        'INSERT INTO calle_osm (nombre, "nombreNorm", departamento, localidad, '
        '"localidadNorm", variantes, "latCentro", "lngCentro", puntos, "wayIds", '
        '"tipoVia") VALUES %s',
        [(
            c['nombre'], c['nombreNorm'], c['departamento'], c.get('localidad'),
            normalizar_lugar(c['localidad']) if c.get('localidad') else None,
            json.dumps(c['variantes'], ensure_ascii=False) if c['variantes'] else None,
            c['lat'], c['lng'], json.dumps(c['puntos']), json.dumps(c['wayIds']),
            c['tipoVia'],
        ) for c in todos],
        page_size=1000,
    )
    pc.execute(
        "INSERT INTO calle_osm_sync_log (tipo, resumen) VALUES ('EXTRACCION', %s)",
        (json.dumps({
            'calles': len(todos),
            'sinDepto': sin_depto,
            'segundos': round(time.time() - t0),
        }),),
    )
    p.commit()

    pc.execute('SELECT departamento, COUNT(*) FROM calle_osm GROUP BY 1 ORDER BY 2 DESC')
    print('\ncalle_osm por depto:')
    for d, n in pc.fetchall():
        print(f'  {d}: {n}')
    pc.execute('SELECT COUNT(*) FROM calle_osm WHERE variantes IS NOT NULL')
    print('con variantes (old/alt/short):', pc.fetchone()[0])
    pc.execute('SELECT COUNT(*) FROM calle_osm WHERE localidad IS NULL')
    print('sin localidad:', pc.fetchone()[0])
    pc.close()
    p.close()
    print('EXTRACCION OK')


if __name__ == '__main__':
    main()
