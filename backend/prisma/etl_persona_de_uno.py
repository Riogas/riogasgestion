# -*- coding: utf-8 -*-
"""Backfill "persona-de-uno" (Task 2.2, spec 2026-07-07).

Crea una `persona` por cada `cliente_uni` que todavía no tiene `personaId`
(1:1 registro crudo <-> persona) y setea los principales (teléfono/dirección)
de esa persona a partir del propio registro. Idempotente: solo procesa filas
con `"personaId" IS NULL`; re-ejecutar imprime `personas creadas: 0`.

NOTA cédula: se inserta `cedula=NULL` en TODAS las personas creadas acá,
aunque el `cliente_uni` de origen tenga cédula cargada. Motivo: hay un
índice único parcial `uq_persona_cedula` sobre `persona(cedula) WHERE cedula
IS NOT NULL`, y como este backfill crea una persona por CADA registro crudo
(1:1), dos registros crudos con la misma cédula (error de carga, hogares
compartidos, etc.) romperían esa unicidad. La cédula curada se completa
después, a mano, por el operador vía el workbench (unificación /
setCanonical), donde ya se resolvió cuál es la persona real.

Uso:
  python etl_persona_de_uno.py
"""
import psycopg2
from psycopg2.extras import execute_values

from _creds import pg_conn_args

CHUNK = 10000


def main():
    conn = psycopg2.connect(**pg_conn_args())
    cur = conn.cursor()

    creadas = 0
    while True:
        cur.execute(
            'SELECT id, nombre, ruc, estado FROM cliente_uni '
            'WHERE "personaId" IS NULL ORDER BY id LIMIT %s',
            (CHUNK,),
        )
        rows = cur.fetchall()
        if not rows:
            break

        # INSERT fila por fila (no execute_values con RETURNING masivo): un
        # INSERT multi-fila con RETURNING no garantiza que Postgres devuelva
        # las filas en el mismo orden en que se listaron en VALUES, así que
        # correlacionar por posición (zip de cu_ids con los ids devueltos)
        # podía pegarle el personaId equivocado a un cliente_uni. Acá cada
        # INSERT trae su propio id, correlacionado 1:1 con el cliente_uni
        # que lo originó.
        updates = []
        for cu_id, nombre, ruc, estado in rows:
            cur.execute(
                'INSERT INTO persona ("nombreOficial", cedula, "rucPrincipal", estado) '
                'VALUES (%s, NULL, %s, %s) RETURNING id',
                (nombre, ruc, estado),
            )
            persona_id = cur.fetchone()[0]
            updates.append((cu_id, persona_id))

        execute_values(
            cur,
            'UPDATE cliente_uni AS cu SET "personaId"=v.personaid '
            'FROM (VALUES %s) AS v(cuid, personaid) WHERE cu.id=v.cuid',
            updates, template='(%s,%s)', page_size=2000,
        )
        conn.commit()
        creadas += len(rows)

    print(f"personas creadas: {creadas:,}")

    # Principales: el teléfono/dirección `principal` del registro crudo (o el
    # primero si ninguno está marcado). Correlacionado por persona, así que
    # es idempotente sin importar cuántas veces se re-corra.
    cur.execute("""
        UPDATE persona p SET
          "telefonoPrincipalId" = (
            SELECT id FROM cliente_telefono WHERE "clienteId"=cu.id
            ORDER BY principal DESC, id LIMIT 1),
          "direccionPrincipalId" = (
            SELECT id FROM cliente_direccion WHERE "clienteId"=cu.id
            ORDER BY principal DESC, id LIMIT 1)
        FROM cliente_uni cu
        WHERE cu."personaId"=p.id AND p."telefonoPrincipalId" IS NULL
    """)
    conn.commit()
    print(f"principales seteados: {cur.rowcount:,}")

    # Aserción post-run: si esto imprime > 0, la correlación quedó rota (o
    # quedaron filas nuevas insertadas por otro proceso mientras corría este
    # script) y hay que investigar antes de seguir con el resto del backfill.
    cur.execute('SELECT count(*) FROM cliente_uni WHERE "personaId" IS NULL')
    faltantes = cur.fetchone()[0]
    print(f"cliente_uni sin personaId tras el run: {faltantes:,}")
    assert faltantes == 0, f"ETL persona-de-uno incompleto: {faltantes} cliente_uni sin personaId"

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
