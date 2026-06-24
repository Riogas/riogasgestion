# -*- coding: utf-8 -*-
"""Detección de clientes duplicados en cliente_uni (NO fusiona, solo marca).
Reglas: (1) mismo RUC válido; (2) mismo teléfono activo (estado='A') entre 2+ clientes
con nombre similar (rapidfuzz token_sort ≥ 0.85). Marca dedup_grupo + dedup_revisar."""
import re
import unicodedata
import psycopg2
from rapidfuzz import fuzz
from _creds import pg_conn_args


def norm(s):
    if not s: return ''
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def main():
    c = psycopg2.connect(**pg_conn_args()); cur = c.cursor()
    cur.execute('UPDATE cliente_uni SET "dedupGrupo"=NULL, "dedupRevisar"=NULL')
    c.commit()

    # --- 1) RUC ---
    cur.execute("""
        WITH g AS (
          SELECT ruc, min(id) AS grupo
          FROM cliente_uni
          WHERE ruc IS NOT NULL AND btrim(ruc) NOT IN ('','0')
          GROUP BY ruc HAVING count(*) > 1
        )
        UPDATE cliente_uni cu SET "dedupGrupo"=g.grupo, "dedupRevisar"=true
        FROM g WHERE cu.ruc = g.ruc
    """)
    c.commit()
    cur.execute('SELECT count(*) FROM cliente_uni WHERE "dedupRevisar"=true')
    por_ruc = cur.fetchone()[0]
    print(f"marcados por RUC: {por_ruc:,}")

    # --- 2) teléfono activo compartido + nombre similar ---
    cur.execute("""
        SELECT t.numero, array_agg(DISTINCT t."clienteId") AS clientes
        FROM cliente_telefono t
        WHERE t.estado='A' AND t.numero IS NOT NULL AND length(btrim(t.numero))>=6
        GROUP BY t.numero
        HAVING count(DISTINCT t."clienteId") BETWEEN 2 AND 50
    """)
    grupos_tel = cur.fetchall()
    print(f"teléfonos activos compartidos: {len(grupos_tel):,}")

    # nombres de los clientes candidatos
    ids = sorted({cid for _, lst in grupos_tel for cid in lst})
    nombres = {}
    for i in range(0, len(ids), 5000):
        chunk = ids[i:i+5000]
        cur.execute('SELECT id, nombre, "dedupGrupo" FROM cliente_uni WHERE id = ANY(%s)', (chunk,))
        for r in cur.fetchall():
            nombres[r[0]] = (norm(r[1]), r[2])

    updates = []  # (id, grupo)
    nuevos = 0
    for numero, lst in grupos_tel:
        lst = [x for x in lst if x in nombres]
        # comparar pares; agrupar los similares con el menor id como grupo
        for a in range(len(lst)):
            for b in range(a+1, len(lst)):
                ia, ib = lst[a], lst[b]
                na, nb = nombres[ia][0], nombres[ib][0]
                if not na or not nb: continue
                if fuzz.token_sort_ratio(na, nb) >= 85:
                    grupo = min(ia, ib, nombres[ia][1] or 10**9, nombres[ib][1] or 10**9)
                    updates.append((ia, grupo)); updates.append((ib, grupo))
                    nuevos += 1
    if updates:
        from psycopg2.extras import execute_values
        execute_values(cur,
            'UPDATE cliente_uni cu SET "dedupGrupo"=LEAST(COALESCE(cu."dedupGrupo",v.grupo),v.grupo), "dedupRevisar"=true '
            'FROM (VALUES %s) AS v(id,grupo) WHERE cu.id=v.id',
            list(set(updates)), template='(%s,%s)', page_size=2000)
        c.commit()
    print(f"pares teléfono+nombre similares: {nuevos:,}")

    cur.execute('SELECT count(*) FROM cliente_uni WHERE "dedupRevisar"=true')
    cur.execute('SELECT count(DISTINCT "dedupGrupo") FROM cliente_uni WHERE "dedupGrupo" IS NOT NULL')
    grupos = cur.fetchone()[0]
    cur.execute('SELECT count(*) FROM cliente_uni WHERE "dedupRevisar"=true')
    marcados = cur.fetchone()[0]
    print(f"TOTAL: {marcados:,} clientes marcados en {grupos:,} grupos de posible duplicado")
    cur.close(); c.close()


if __name__ == '__main__':
    main()
