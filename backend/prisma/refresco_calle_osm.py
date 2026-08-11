# -*- coding: utf-8 -*-
"""Job de refresco del puente nomenclator<->OSM. Correr semanal.

Esto ES el reemplazo del "proceso" manual que dolía con el nomenclator viejo:

1. Snapshot del catálogo OSM actual (nombre por depto+localidad).
2. Re-extracción completa (extraer_calle_osm) — OSM se actualiza solo, las
   réplicas quedaron andando el 2026-08-11.
3. Diff: calles nuevas / renombradas (vía old_name) / desaparecidas.
4. Re-matching completo (matching_calles) — respeta lo revisado a mano.
5. Log en calle_osm_sync_log tipo DIFF, visible desde el panel.

El re-sync del lado AS400 (etl_nomenclator) va aparte y on-demand: necesita
jt400/JVM y el nomenclator legacy cambia poco — ese es justamente el punto.

Uso:  python refresco_calle_osm.py [--sin-matching]
"""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

import psycopg2
import requests

from _creds import pg_conn_args

PG = pg_conn_args()
AQUI = Path(__file__).resolve().parent

# Guardas aprendidas del incidente Roberto Berro (2026-08-11): la extracción
# corrió mientras Overpass aplicaba 4 meses de diffs y ~60 ways quedaron
# afuera — entre ellas "Doctor Roberto Berro" (2.114 usos de clientes), y la
# pasada geométrica eligió la calle paralela.
MAX_ATRASO_DIAS = 8          # réplica más vieja que esto = está trancada de nuevo
MIN_RATIO_CATALOGO = 0.90    # el catálogo nuevo no puede encoger más de 10%


def verificar_replica_overpass() -> None:
    import os
    base = os.environ.get('OVERPASS_URL', 'http://overpass.riogas.uy').rstrip('/')
    r = requests.get(
        base + '/api/interpreter',
        params={'data': '[out:json];node(1);out;'}, timeout=30,
    )
    r.raise_for_status()
    base = r.json()['osm3s']['timestamp_osm_base']
    fecha = datetime.fromisoformat(base.replace('Z', '+00:00'))
    atraso = datetime.now(timezone.utc) - fecha
    print(f'replica overpass: {base} (atraso {atraso.days}d)')
    if atraso > timedelta(days=MAX_ATRASO_DIAS):
        print(f'ABORTADO: la replica de Overpass esta trancada '
              f'(>{MAX_ATRASO_DIAS} dias). Revisar el contenedor en la VM osm '
              f'(gotchas en el registro de infra) antes de refrescar, o el '
              f'catalogo nuevo naceria viejo.')
        sys.exit(2)


def snapshot(pc) -> dict[str, dict]:
    pc.execute('''SELECT departamento || '|' || COALESCE(localidad,'') || '|' || "nombreNorm",
                         nombre, variantes
                  FROM calle_osm WHERE activo''')
    return {clave: {'nombre': n, 'variantes': v} for clave, n, v in pc.fetchall()}


def correr(script: list[str]) -> int:
    print(f'>> {" ".join(script)}')
    return subprocess.run([sys.executable, *script], cwd=AQUI).returncode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sin-matching', action='store_true')
    args = ap.parse_args()
    t0 = time.time()

    verificar_replica_overpass()

    p = psycopg2.connect(**PG)
    pc = p.cursor()
    antes = snapshot(pc)
    print(f'snapshot previo: {len(antes)} calles')

    pc.close()
    p.close()
    if correr(['extraer_calle_osm.py']) != 0:
        print('EXTRACCION FALLO — se aborta sin tocar nada más')
        sys.exit(1)

    # Reconectar: la extracción escribió con su propia conexión.
    p = psycopg2.connect(**PG)
    pc = p.cursor()
    despues = snapshot(pc)
    pc.close()
    p.close()

    if antes and len(despues) < len(antes) * MIN_RATIO_CATALOGO:
        print(f'OJO: el catálogo encogió {len(antes)} → {len(despues)} '
              f'(más del {int((1-MIN_RATIO_CATALOGO)*100)}%). Huele a extracción '
              f'incompleta; NO se corre el matching para no romper matches sanos. '
              f'Revisar y correr matching_calles.py a mano si el encogimiento es real.')
        args.sin_matching = True

    claves_antes = set(antes)
    claves_despues = set(despues)
    nuevas = sorted(claves_despues - claves_antes)
    desaparecidas = sorted(claves_antes - claves_despues)

    # Renombres: una desaparecida cuyo nombre viejo aparece como old_name de
    # una nueva en el mismo scope.
    renombres = []
    viejos_por_scope = {}
    for clave in desaparecidas:
        scope = clave.rsplit('|', 1)[0]
        viejos_por_scope.setdefault(scope, []).append(
            (clave, antes[clave]['nombre']))
    for clave in nuevas:
        scope = clave.rsplit('|', 1)[0]
        variantes = despues[clave].get('variantes') or []
        nombres_viejos = {
            (v.get('nombre') or '').upper()
            for v in variantes if v.get('tipo') == 'old'
        }
        for clave_vieja, nombre_viejo in viejos_por_scope.get(scope, []):
            if nombre_viejo and nombre_viejo.upper() in nombres_viejos:
                renombres.append({'antes': nombre_viejo, 'ahora': despues[clave]['nombre']})

    resumen = {
        'total': len(despues),
        'nuevas': len(nuevas),
        'desaparecidas': len(desaparecidas),
        'renombresDetectados': len(renombres),
        'ejemplosNuevas': [despues[c]['nombre'] for c in nuevas[:15]],
        'ejemplosDesaparecidas': [antes[c]['nombre'] for c in desaparecidas[:15]],
        'renombres': renombres[:15],
        'segundos': round(time.time() - t0),
    }

    if not args.sin_matching:
        if correr(['matching_calles.py']) != 0:
            resumen['matching'] = 'FALLO'

    p2 = psycopg2.connect(**PG)
    pc2 = p2.cursor()
    pc2.execute(
        "INSERT INTO calle_osm_sync_log (tipo, resumen) VALUES ('DIFF', %s)",
        (json.dumps(resumen, ensure_ascii=False),),
    )
    p2.commit()
    pc2.close()
    p2.close()

    print('\n=== DIFF ===')
    print(json.dumps(resumen, indent=1, ensure_ascii=False))
    print('REFRESCO OK')


if __name__ == '__main__':
    main()
