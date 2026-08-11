# -*- coding: utf-8 -*-
"""Matching nomenclator <-> OSM en tres pasadas -> goya.calle_match.

1. NOMBRE: exacto (canonico, sin tipo de via, variantes OSM, EXCALNOM) y
   fuzzy (rapidfuzz token_sort) dentro del mismo departamento, con bonus
   si la localidad OSM coincide con la ciudad del nomenclator.
2. GEOMETRIA: la nube de clientes geolocalizados de cada CALID (goya.cliente)
   contra los puntos muestrales de cada calle OSM, via grilla espacial.
   Es la pasada que encuentra renombres que el fuzzy no puede.
3. CRUCE: coinciden -> AUTO_CONFIRMADO; discrepan o senal debil -> A_REVISAR
   con la evidencia en `detalle`. Sin fila = sin match.

Re-ejecutable: pisa todo salvo lo revisado a mano (CONFIRMADO_MANUAL/RECHAZADO).
"""
import json
import math
import sys
import time
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

import psycopg2
from psycopg2.extras import execute_values
from rapidfuzz import fuzz, process

from _creds import pg_conn_args
from _normcalle import (
    clave_esencial,
    es_calle_real,
    es_nombre_generico,
    normalizar_calle,
    normalizar_lugar,
    sin_tipo_via,
)

PG = pg_conn_args()

FUZZY_MIN = 80          # debajo de esto ni se considera
FUZZY_AUTO = 92         # fuzzy alto + geo ok -> auto
AMBIGUO_DELTA = 3       # dos candidatos a menos de esto = ambiguo
GEO_CELDA = 0.004       # ~400 m de grilla
# 150 m: en la cuadricula de Montevideo las calles estan a ~100 m; con un
# radio mayor la nube "toca" todas las paralelas y la pasada no discrimina.
GEO_RADIO_KM = 0.15
GEO_MIN_CLIENTES = 3
BBOX = (-35.2, -58.6, -29.9, -53.0)  # lat/lng validos de Uruguay


def hav_km(lat1, lng1, lat2, lng2):
    la1, lo1, la2, lo2 = map(math.radians, (lat1, lng1, lat2, lng2))
    h = math.sin((la2 - la1) / 2) ** 2 + \
        math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def celda(lat, lng):
    return (int(lat / GEO_CELDA), int(lng / GEO_CELDA))


def main():  # noqa: C901 - batch largo y lineal, mas claro asi
    t0 = time.time()
    p = psycopg2.connect(**PG)
    pc = p.cursor()

    # ---------- cargar ----------
    pc.execute('SELECT id, nombre FROM depto_nomenclator')
    depto_nom = {i: n for i, n in pc.fetchall()}
    pc.execute('SELECT id, "deptoId", nombre FROM ciudad_nomenclator')
    ciudad_nom = {i: (d, n) for i, d, n in pc.fetchall()}

    pc.execute('''SELECT id, nombre, "exNombre", "nombreIca", "ciudadId",
                         "deptoId", "cantClientesReal"
                  FROM calle WHERE nombre IS NOT NULL''')
    calles = pc.fetchall()

    pc.execute('''SELECT id, nombre, "nombreNorm", departamento, "localidadNorm",
                         variantes, "latCentro", "lngCentro", puntos
                  FROM calle_osm WHERE activo''')
    osm = pc.fetchall()
    print(f'nomenclator: {len(calles)} calles | osm: {len(osm)} calles')

    # ---------- indices por nombre ----------
    # depto nomenclator (MAYUSCULAS) -> nombre OSM del depto, via normalizacion
    osm_deptos = {normalizar_lugar(d) for _, _, _, d, _, _, _, _, _ in osm}
    map_depto = {}
    for did, dnom in depto_nom.items():
        n = normalizar_lugar(dnom or '')
        map_depto[did] = n if n in osm_deptos else None

    idx_exacto = defaultdict(list)      # (deptoNorm, norm) -> [osmId]
    idx_sintipo = defaultdict(list)
    idx_variante = defaultdict(list)    # variantes old/alt/short normalizadas
    idx_esencial = defaultdict(list)    # sin tipo/honoríficos/iniciales
    formas_por_depto = defaultdict(list)  # deptoNorm -> [(forma, osmId)]
    osm_por_id = {}
    for oid, nombre, norm, depto, locn, variantes, lat, lng, puntos in osm:
        dn = normalizar_lugar(depto)
        osm_por_id[oid] = {
            'nombre': nombre, 'norm': norm, 'depto': dn, 'loc': locn,
            'lat': float(lat), 'lng': float(lng),
            'puntos': puntos or [],
        }
        idx_exacto[(dn, norm)].append(oid)
        st = sin_tipo_via(norm)
        if st != norm:
            idx_sintipo[(dn, st)].append(oid)
        # Los nombres genéricos (CALLE 1, PASAJE A) no participan de los
        # índices por esencia ni del fuzzy: no identifican nada por nombre.
        if not es_nombre_generico(norm):
            idx_esencial[(dn, clave_esencial(norm))].append(oid)
            formas_por_depto[dn].append((norm, oid))
        for v in (variantes or []):
            vn = normalizar_calle(v.get('nombre', ''))
            if vn and not es_nombre_generico(vn):
                idx_variante[(dn, vn)].append(oid)

    # ---------- pasada geometrica: preparar grilla ----------
    grilla = defaultdict(set)  # celda -> {osmId}
    for oid, o in osm_por_id.items():
        for lat, lng in o['puntos']:
            c = celda(lat, lng)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    grilla[(c[0] + dx, c[1] + dy)].add(oid)

    print('cargando nubes de clientes...')
    pc.execute('''SELECT "callePrincipalId", "geoLat"::float, "geoLng"::float
                  FROM (
                    SELECT "callePrincipalId", "geoLat", "geoLng",
                           ROW_NUMBER() OVER (PARTITION BY "callePrincipalId"
                                              ORDER BY id) rn
                    FROM cliente
                    WHERE "callePrincipalId" IS NOT NULL
                      AND "geoLat" IS NOT NULL AND "geoLng" IS NOT NULL
                  ) t WHERE rn <= 150''')
    nubes = defaultdict(list)
    for cid, lat, lng in pc.fetchall():
        if BBOX[0] < lat < BBOX[2] and BBOX[1] < lng < BBOX[3]:
            nubes[cid].append((lat, lng))
    print(f'nubes: {len(nubes)} calles con clientes geolocalizados')

    def ratios_geometricos(puntos_cliente):
        """Por cada calle OSM cercana: que fraccion de la nube la 'toca'.
        Devuelve el mapa completo, no un argmax: en una cuadricula varias
        paralelas puntuan alto y hay que poder comparar con el candidato."""
        hits = defaultdict(int)
        for lat, lng in puntos_cliente:
            cerca = grilla.get(celda(lat, lng), ())
            tocadas = set()
            for oid in cerca:
                for plat, plng in osm_por_id[oid]['puntos']:
                    if hav_km(lat, lng, plat, plng) <= GEO_RADIO_KM:
                        tocadas.add(oid)
                        break
            for oid in tocadas:
                hits[oid] += 1
        n = len(puntos_cliente)
        return {oid: h / n for oid, h in hits.items()}

    # ---------- matching ----------
    filas = []
    stats = defaultdict(int)
    ejemplos_revisar = []

    for calid, nombre, exnombre, nombreica, ciuid, depid, clientes in calles:
        clientes = clientes or 0
        if not es_calle_real(nombre):
            stats['no_es_calle'] += 1
            continue
        dn = map_depto.get(depid)
        if not dn:
            stats['sin_depto_osm'] += 1
            continue

        ciudad_n = None
        if ciuid in ciudad_nom:
            ciudad_n = normalizar_lugar(ciudad_nom[ciuid][1] or '')

        # Las formas con nombre genérico (el exNombre 'CALLE 1(COLON NORTE)'
        # de Bonmesadri) no nominan candidatos: una CALLE 1 cualquiera del
        # departamento no tiene nada que ver. Esas calles solo pueden
        # enlazarse por geometría.
        formas_nom = []
        for orig, etiqueta in ((nombre, 'nombre'), (exnombre, 'exNombre'),
                               (nombreica, 'nombreIca')):
            if orig:
                nn = normalizar_calle(orig)
                if nn and not es_nombre_generico(nn) and \
                        (nn, etiqueta) not in [(f, e) for f, e, _ in formas_nom]:
                    formas_nom.append((nn, etiqueta, orig))

        # -- exactos --
        candidatos = {}  # osmId -> (score, metodo, evidencia)
        for nn, etiqueta, orig in formas_nom:
            for oid in idx_exacto.get((dn, nn), []):
                candidatos.setdefault(oid, (1.0, 'EXACTO', f'{etiqueta} exacto'))
            for oid in idx_sintipo.get((dn, nn), []):
                candidatos.setdefault(oid, (0.97, 'EXACTO', f'{etiqueta} sin tipo de via'))
            st = sin_tipo_via(nn)
            if st != nn:
                for oid in idx_exacto.get((dn, st), []):
                    candidatos.setdefault(oid, (0.97, 'EXACTO', f'{etiqueta} sin tipo de via'))
            for oid in idx_variante.get((dn, nn), []):
                candidatos.setdefault(oid, (0.95, 'EXACTO', f'{etiqueta} = variante OSM'))
            # Clave esencial: sin títulos civiles ni iniciales sueltas.
            # 'DOCTOR JOSE TERRA' ↔ 'José L. Terra' (caso José Terra).
            for oid in idx_esencial.get((dn, clave_esencial(nn)), []):
                candidatos.setdefault(oid, (0.90, 'EXACTO', f'{etiqueta} por clave esencial'))

        # -- fuzzy (solo si no hay exacto; sin formas útiles va directo a geometría) --
        if not candidatos and formas_nom:
            formas = formas_por_depto[dn]
            base = formas_nom[0][0]
            res = process.extract(
                base, [f for f, _ in formas], scorer=fuzz.token_sort_ratio,
                score_cutoff=68, limit=10,
            )
            for forma, score, idx in res:
                # "DOCTOR JUAN PAULLIER" vs "JUAN PAULLIER" da token_sort 79:
                # el honorífico lo hunde bajo el corte. Si una forma es
                # subconjunto exacto de la otra (token_set 100), se acepta
                # con corte más bajo — es la misma calle con el nombre más
                # corto o más completo.
                subconjunto = fuzz.token_set_ratio(base, forma) == 100
                if score < FUZZY_MIN and not subconjunto:
                    continue
                oid = formas[idx][1]
                mejor = candidatos.get(oid)
                if not mejor or score / 100 > mejor[0]:
                    etiqueta = 'subconjunto' if subconjunto and score < FUZZY_MIN else 'fuzzy'
                    candidatos[oid] = (round(score / 100, 4), 'FUZZY',
                                       f'{etiqueta} {score:.0f} vs "{osm_por_id[oid]["nombre"]}"')

        # -- bonus por localidad + eleccion --
        puntuados = []
        for oid, (score, metodo, evid) in candidatos.items():
            bono = 0.03 if (ciudad_n and osm_por_id[oid]['loc'] == ciudad_n) else 0.0
            puntuados.append((min(score + bono, 1.0), score, oid, metodo, evid))
        puntuados.sort(reverse=True)

        # -- geometria --
        nube = nubes.get(calid, [])
        ratios = ratios_geometricos(nube) if len(nube) >= GEO_MIN_CLIENTES else {}
        geo_orden = sorted(ratios.items(), key=lambda kv: -kv[1])

        elegido = None
        if puntuados:
            total, score, oid, metodo, evid = puntuados[0]

            # La geometría decide ENTRE candidatos con nombre plausible: si la
            # nube domina sobre otro candidato y al elegido ni lo toca, ese
            # otro es la calle. Caso ROBERTO BERRO: "Roberto Barry" fuzzy 85
            # con 0% de nube vs "Doctor Roberto Berro" subconjunto 79 con la
            # nube encima — gana Berro.
            if len(puntuados) > 1 and ratios.get(oid, 0.0) < 0.3:
                mejor_geo = max(
                    (p for p in puntuados[1:] if ratios.get(p[2], 0.0) >= 0.6),
                    key=lambda p: ratios[p[2]],
                    default=None,
                )
                if mejor_geo:
                    total, score, oid, metodo, evid = mejor_geo
                    evid += ' + la nube de clientes decide entre candidatos'

            # Ambigüedad sobre el score CRUDO: que el nombre vigente (1.0)
            # empate contra el old_name de otra calle (0.95) no es ambiguo —
            # el nombre actual gana. Solo empatan pares del mismo nivel.
            ambiguo = len(puntuados) > 1 and (score - puntuados[1][1]) * 100 < AMBIGUO_DELTA
            ratio_cand = ratios.get(oid, 0.0)

            # Una calle larga puede venir partida en varios clusters del MISMO
            # nombre (5.241 clusters vs 4.767 nombres en MVD): si otro tramo
            # homónimo puntúa mejor con la nube, la geometría elige el cluster
            # y de paso mata la ambigüedad.
            mejor_homonimo = None
            for o, r in geo_orden:
                if r >= 0.5 and r > ratio_cand and \
                        osm_por_id[o]['norm'] == osm_por_id[oid]['norm']:
                    mejor_homonimo = (o, r)
                    break
            if mejor_homonimo:
                oid, ratio_cand = mejor_homonimo
                ambiguo = False
                evid += ' + cluster elegido por geometría'

            geo_confirma = ratio_cand >= 0.5
            if geo_confirma:
                ambiguo = False

            # Empate entre "homónimos equivalentes": todos los casi-empatados
            # son la MISMA calle real (mismo nombre sin tipo de vía, misma
            # localidad) partida en clusters, o la variante con/sin "Bulevar".
            # Elegir cualquiera enlaza el mismo CALID a la misma calle: no
            # hay nada que revisar.
            if ambiguo:
                clave_elegido = (sin_tipo_via(osm_por_id[oid]['norm']),
                                 osm_por_id[oid]['loc'])
                casi_empatados = [
                    o for _, s, o, _, _ in puntuados[1:]
                    if (score - s) * 100 < AMBIGUO_DELTA
                ]
                if casi_empatados and all(
                    (sin_tipo_via(osm_por_id[o]['norm']), osm_por_id[o]['loc'])
                    == clave_elegido
                    for o in casi_empatados
                ):
                    ambiguo = False
                    evid += ' (homónimos equivalentes)'

            # Contradicción REAL: el candidato casi no toca la nube y otra
            # calle de nombre distinto la domina con claridad.
            geo_top = next(
                ((o, r) for o, r in geo_orden
                 if osm_por_id[o]['norm'] != osm_por_id[oid]['norm']),
                None,
            )
            geo_contradice = (
                geo_top is not None and len(nube) >= 10
                and ratio_cand < 0.3 and geo_top[1] >= 0.7
            )

            # Subconjunto de nombre (DOCTOR JUAN PAULLIER ↔ Juan Paullier)
            # CON los clientes viviendo sobre la calle: dos señales
            # independientes que coinciden — no necesita ojo humano.
            fuzzy_fuerte = score * 100 >= FUZZY_AUTO or 'subconjunto' in evid

            if metodo == 'EXACTO' and not ambiguo and not geo_contradice:
                estado = 'AUTO_CONFIRMADO'
            elif metodo == 'FUZZY' and fuzzy_fuerte and geo_confirma:
                estado = 'AUTO_CONFIRMADO'
            else:
                estado = 'A_REVISAR'
            detalle = {
                'evidencia': evid, 'scoreNombre': score,
                'bonusLocalidad': round(total - score, 2),
                'ambiguo': ambiguo,
                'geo': {'coincide': geo_confirma, 'contradice': geo_contradice,
                        'ratio': round(ratio_cand, 2), 'clientes': len(nube)},
            }
            if ambiguo:
                detalle['alternativas'] = [
                    {'osmId': o, 'nombre': osm_por_id[o]['nombre'], 'score': s}
                    for _, s, o, _, _ in puntuados[1:3]
                ]
            if geo_contradice and geo_top:
                detalle['geoSugiere'] = {
                    'osmId': geo_top[0], 'nombre': osm_por_id[geo_top[0]]['nombre'],
                    'ratio': round(geo_top[1], 2),
                }
            elegido = (calid, oid, round(total, 4), metodo, estado, clientes, detalle)
        elif geo_orden and len(nube) >= 5:
            # Ni el nombre se parece, pero los clientes viven sobre esa calle:
            # el caso "renombre total". Exige DOMINANCIA: en una cuadricula las
            # paralelas también puntúan y ahí la geometría sola no alcanza.
            geo_oid, geo_ratio = geo_orden[0]
            segunda = next(
                (r for o, r in geo_orden[1:]
                 if osm_por_id[o]['norm'] != osm_por_id[geo_oid]['norm']),
                0.0,
            )
            if geo_ratio >= 0.7 and segunda < geo_ratio * 0.8:
                detalle = {
                    'evidencia': f'solo geometria: {geo_ratio:.0%} de {len(nube)} '
                                 f'clientes sobre "{osm_por_id[geo_oid]["nombre"]}"',
                    'scoreNombre': 0,
                    'geo': {'ratio': round(geo_ratio, 2), 'clientes': len(nube)},
                }
                elegido = (calid, geo_oid, round(geo_ratio, 4), 'GEOMETRICO',
                           'A_REVISAR', clientes, detalle)

        if elegido:
            filas.append(elegido)
            stats[f'{elegido[4]}|{elegido[3]}'] += 1
            if elegido[4] == 'A_REVISAR' and len(ejemplos_revisar) < 15 and clientes > 100:
                ejemplos_revisar.append(
                    f'  CALID {calid} "{nombre}" ({clientes} cli) -> '
                    f'"{osm_por_id[elegido[1]]["nombre"]}" [{elegido[6]["evidencia"]}]'
                )
        else:
            stats['sin_match'] += 1

    # ---------- persistir (respetando lo revisado a mano) ----------
    pc.execute('''DELETE FROM calle_match
                  WHERE estado NOT IN ('CONFIRMADO_MANUAL','RECHAZADO')''')
    pc.execute('''SELECT "calleId" FROM calle_match''')
    protegidos = {r[0] for r in pc.fetchall()}
    filas_final = [f for f in filas if f[0] not in protegidos]
    execute_values(
        pc,
        'INSERT INTO calle_match ("calleId", "calleOsmId", score, metodo, estado, '
        '"clientesCant", detalle) VALUES %s '
        'ON CONFLICT ("calleId", "calleOsmId") DO NOTHING',
        [(c, o, s, m, e, n, json.dumps(d, ensure_ascii=False))
         for c, o, s, m, e, n, d in filas_final],
        page_size=1000,
    )
    p.commit()

    # ---------- reporte ----------
    pc.execute('''SELECT estado, metodo, COUNT(*), SUM("clientesCant")
                  FROM calle_match GROUP BY 1, 2 ORDER BY 1, 2''')
    tabla = pc.fetchall()

    pc.execute('''SELECT COUNT(*), COALESCE(SUM("cantClientesReal"),0) FROM calle
                  WHERE nombre IS NOT NULL''')
    tot_calles, tot_clientes = pc.fetchone()
    pc.execute('''SELECT COUNT(DISTINCT m."calleId"), COALESCE(SUM(c."cantClientesReal"),0)
                  FROM calle_match m
                  JOIN calle c ON c.id = m."calleId"''')
    con_match, clientes_match = pc.fetchone()

    # top-1000 por clientes: cuantas tienen match
    pc.execute('''WITH top AS (
                    SELECT id FROM calle WHERE nombre IS NOT NULL
                    ORDER BY "cantClientesReal" DESC NULLS LAST LIMIT 1000)
                  SELECT COUNT(*) FROM top
                  WHERE id IN (SELECT "calleId" FROM calle_match)''')
    top1000 = pc.fetchone()[0]

    lineas = [
        '# Reporte de matching nomenclator <-> OSM',
        f'Corrida: {time.strftime("%Y-%m-%d %H:%M")} | {time.time()-t0:.0f}s',
        '',
        f'- Calles del nomenclator: {tot_calles} ({tot_clientes} usos de clientes)',
        f'- Con match: {con_match} ({con_match/tot_calles:.1%})',
        f'- Usos de clientes cubiertos: {clientes_match} ({clientes_match/max(tot_clientes,1):.1%})',
        f'- Top-1000 por clientes con match: {top1000} ({top1000/10:.1f}%)',
        '',
        '| estado | metodo | calles | clientes |',
        '|---|---|---|---|',
    ]
    for e, m, n, cl in tabla:
        lineas.append(f'| {e} | {m} | {n} | {cl} |')
    lineas += ['', '## Descartes', '']
    for k in ('no_es_calle', 'sin_depto_osm', 'sin_match'):
        lineas.append(f'- {k}: {stats.get(k, 0)}')
    if ejemplos_revisar:
        lineas += ['', '## Ejemplos A_REVISAR con muchos clientes', ''] + ejemplos_revisar

    reporte = '\n'.join(lineas)
    with open('reporte_matching.md', 'w', encoding='utf-8') as f:
        f.write(reporte + '\n')
    pc.execute(
        "INSERT INTO calle_osm_sync_log (tipo, resumen) VALUES ('MATCHING', %s)",
        (json.dumps({
            'conMatch': con_match, 'total': tot_calles, 'top1000': top1000,
            'clientesCubiertos': int(clientes_match), 'segundos': round(time.time() - t0),
        }),),
    )
    p.commit()
    pc.close()
    p.close()
    print(reporte)


if __name__ == '__main__':
    main()
