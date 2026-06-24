# -*- coding: utf-8 -*-
"""Re-dimensiona CAPITAL: tabla `cliente` plana (goya, ex-GXCALDTA) -> cliente_uni + cliente_direccion.
Server-side (INSERT...SELECT). Idempotente: borra y recarga origen='capital'. Puesto Montevideo=100."""
import psycopg2
from _creds import pg_conn_args

MONTEVIDEO = 100


def main():
    c = psycopg2.connect(**pg_conn_args()); cur = c.cursor()

    # idempotencia: limpiar capital
    cur.execute("DELETE FROM cliente_direccion WHERE \"clienteId\" IN (SELECT id FROM cliente_uni WHERE origen='capital')")
    cur.execute("DELETE FROM cliente_uni WHERE origen='capital'")
    c.commit()

    # 1) cliente_uni (slim) desde el plano
    cur.execute("""
        INSERT INTO cliente_uni
          (origen,"idOriginal",nombre,ruc,cedula,email,estado,"tipoClienteId",vip,
           observaciones,"observacionesComerc","tipoServicioId","gciNro",
           "fechaAlta","ultimaLlamada","operadorAlta","operadorModificacion","createdAt","updatedAt")
        SELECT 'capital', id, nombre, ruc, NULL, email, estado, "tipoId", vip,
               observaciones, "observacionesComerciales", "tipoServicioId", "nroGci",
               "fechaAlta", "fechaUltimaLlamada", "operadorAlta", "operadorModificacion", now(), now()
        FROM cliente
    """)
    print("cliente_uni capital:", cur.rowcount)
    c.commit()

    # 2) cliente_direccion desde el plano (geo ya calculada), join por idOriginal
    cur.execute(f"""
        INSERT INTO cliente_direccion
          ("clienteId","puestoId","departamentoId","localidadId",direccion,calle,nro,
           bis,apto,"blockSolar",nivel,local,manzana,km,observaciones,
           lat,lng,"geoFuente","calleMatch","geoVerificadoAt",principal,estado)
        SELECT cu.id, {MONTEVIDEO}, NULL, NULL, c.direccion, c."calleGeo",
               COALESCE(c."numeroPuertaGeo", NULLIF(c."numeroPuerta",0)::text),
               c.bis, c.apartamento, c."blockSolar", c.nivel, c.local, c."numeroManzana",
               c.km::text, c."observacionesDireccion",
               c."geoLat", c."geoLng", c."geoFuente", c."calleMatch", c."geoVerificadoAt", true, c.estado
        FROM cliente c JOIN cliente_uni cu ON cu.origen='capital' AND cu."idOriginal"=c.id
    """)
    print("cliente_direccion capital:", cur.rowcount)
    c.commit()

    # validación
    cur.execute("SELECT count(*) FROM cliente_uni WHERE origen='capital'"); print("  uni:", cur.fetchone()[0])
    cur.execute("SELECT count(*) FROM cliente_direccion WHERE \"puestoId\"=%s", (MONTEVIDEO,)); print("  dir:", cur.fetchone()[0])
    cur.execute("""SELECT cu.id, cu.nombre, d.direccion, d.calle, d."calleMatch"
                   FROM cliente_uni cu JOIN cliente_direccion d ON d."clienteId"=cu.id
                   WHERE cu.origen='capital' AND d.direccion IS NOT NULL LIMIT 3""")
    for r in cur.fetchall(): print("  sample:", r)
    cur.close(); c.close(); print("OK capital split")


if __name__ == '__main__':
    main()
