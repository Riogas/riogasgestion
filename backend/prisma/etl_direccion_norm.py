# -*- coding: utf-8 -*-
"""Backfill de `direccionTextoNorm` en cliente_direccion (Task 2.1, spec 2026-07-07).

Calcula la clave normalizada de dirección (mismo algoritmo que
backend/src/common/direccion/normalize-direccion.ts, vía _normdir.py) para
TODAS las filas de cliente_direccion, en chunks de 10k por id (keyset, sin
OFFSET). Re-ejecutable: recalcula y sobreescribe siempre (idempotente, la
salida es determinística para los mismos datos crudos).

Uso:
  python etl_direccion_norm.py
"""
import psycopg2
from psycopg2.extras import execute_values

from _creds import pg_conn_args
from _normdir import normalize_direccion

CHUNK = 10000


def main():
    conn = psycopg2.connect(**pg_conn_args())
    cur = conn.cursor()

    last_id = 0
    actualizadas = 0
    while True:
        cur.execute(
            'SELECT id, "departamentoId", "localidadId", calle, nro, apto '
            'FROM cliente_direccion WHERE id > %s ORDER BY id LIMIT %s',
            (last_id, CHUNK),
        )
        rows = cur.fetchall()
        if not rows:
            break
        last_id = rows[-1][0]

        updates = [
            (id_, normalize_direccion(dep, loc, calle, nro, apto))
            for id_, dep, loc, calle, nro, apto in rows
        ]
        execute_values(
            cur,
            'UPDATE cliente_direccion AS cd SET "direccionTextoNorm"=v.clave '
            'FROM (VALUES %s) AS v(id, clave) WHERE cd.id=v.id',
            updates, template='(%s,%s)', page_size=2000,
        )
        conn.commit()

        actualizadas += len(updates)
        if actualizadas % 100000 == 0:
            print(f"  {actualizadas:,} procesadas...", flush=True)

    print(f"actualizadas: {actualizadas:,}")
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
