# -*- coding: utf-8 -*-
"""Teléfonos CAPITAL: GXCALDTA.TELCLI (AS400) -> cliente_telefono.
Resuelve cliente_uni.id por (origen='capital', idOriginal=CLIID). Re-ejecutable."""
import os
os.environ['JAVA_HOME'] = r'C:\Program Files\Java\jdk-21'
import jaydebeapi
import psycopg2
from psycopg2.extras import execute_values
from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()


def s(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def main():
    p = psycopg2.connect(**pg_conn_args()); pc = p.cursor()
    pc.execute("DELETE FROM cliente_telefono WHERE \"clienteId\" IN (SELECT id FROM cliente_uni WHERE origen='capital')")
    p.commit()
    pc.execute("SELECT \"idOriginal\", id FROM cliente_uni WHERE origen='capital'")
    idmap = {int(r[0]): r[1] for r in pc.fetchall()}
    print("map capital:", len(idmap))

    a = jaydebeapi.connect("com.ibm.as400.access.AS400JDBCDriver", AS400_URL, AS400_PROPS, AS400_JAR)
    ac = a.cursor()
    ac.execute("SELECT TELFNRO, CLIID, CLITELESTA, CLITELOBS FROM GXCALDTA.TELCLI")
    total = ins = huerf = 0
    while True:
        rows = ac.fetchmany(20000)
        if not rows:
            break
        batch = []
        for r in rows:
            total += 1
            cid = idmap.get(int(r[1])) if r[1] is not None else None
            if cid is None:
                huerf += 1
                continue
            numero = s(r[0])
            if not numero:
                continue
            batch.append((cid, numero[:20], s(r[2]), s(r[3])[:60] if s(r[3]) else None))
        if batch:
            execute_values(pc,
                'INSERT INTO cliente_telefono ("clienteId",numero,estado,obs,principal) VALUES %s',
                batch, template='(%s,%s,%s,%s,false)', page_size=5000)
            p.commit(); ins += len(batch)
        if total % 200000 == 0:
            print(f"  {total:,} leídos, {ins:,} insertados, {huerf:,} huérfanos", flush=True)
    ac.close(); a.close()
    pc.execute("SELECT count(*) FROM cliente_telefono ct JOIN cliente_uni cu ON cu.id=ct.\"clienteId\" WHERE cu.origen='capital'")
    print(f"FIN. leídos={total:,} insertados={ins:,} huérfanos={huerf:,} | en DB={pc.fetchone()[0]:,}")
    pc.close(); p.close()


if __name__ == '__main__':
    main()
