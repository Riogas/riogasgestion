# -*- coding: utf-8 -*-
"""Teléfonos INTERIOR: PUESTOS.CLITEL (AS400) -> cliente_telefono.
Resuelve cliente_uni.id por (origen='interior', idOriginal=CLIID, idOriginalPuesto=CLIPUESTOID)."""
import os
os.environ['JAVA_HOME'] = r'C:\Program Files\Java\jdk-21'
import jaydebeapi
import psycopg2
from psycopg2.extras import execute_values
from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()


def s(v):
    if v is None: return None
    v = str(v).strip(); return v or None


def main():
    p = psycopg2.connect(**pg_conn_args()); pc = p.cursor()
    pc.execute("DELETE FROM cliente_telefono WHERE \"clienteId\" IN (SELECT id FROM cliente_uni WHERE origen='interior')")
    p.commit()
    pc.execute("SELECT \"idOriginal\",\"idOriginalPuesto\",id FROM cliente_uni WHERE origen='interior'")
    idmap = {(int(a_), int(b_)): c_ for a_, b_, c_ in pc.fetchall()}
    print("map interior:", len(idmap))

    a = jaydebeapi.connect("com.ibm.as400.access.AS400JDBCDriver", AS400_URL, AS400_PROPS, AS400_JAR)
    ac = a.cursor()
    ac.execute("SELECT TELFNRO, CLIPUESTOID, CLIID, CLITELESTADO, TELTIPO FROM PUESTOS.CLITEL")
    total = ins = huerf = 0
    while True:
        rows = ac.fetchmany(20000)
        if not rows: break
        batch = []
        for r in rows:
            total += 1
            cid = idmap.get((int(r[2]), int(r[1]))) if r[1] is not None and r[2] is not None else None
            if cid is None:
                huerf += 1; continue
            numero = s(r[0])
            if not numero: continue
            batch.append((cid, numero[:20], s(r[4]), s(r[3])))
        if batch:
            execute_values(pc, 'INSERT INTO cliente_telefono ("clienteId",numero,tipo,estado,principal) VALUES %s',
                           batch, template='(%s,%s,%s,%s,false)', page_size=5000)
            p.commit(); ins += len(batch)
    ac.close(); a.close()
    print(f"FIN interior tel. leídos={total:,} insertados={ins:,} huérfanos={huerf:,}")
    pc.close(); p.close()


if __name__ == '__main__':
    main()
