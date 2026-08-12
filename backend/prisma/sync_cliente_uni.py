# -*- coding: utf-8 -*-
"""Sync incremental: cliente (plana ex-AS400) -> modelo unificado del panel.

El panel de clientes NO lee la tabla plana `cliente`: lee cliente_uni +
cliente_direccion + cliente_telefono (+ persona). reimport_clientes.py refresca
la plana; este script propaga eso al unificado SIN destruir nada — a diferencia
de etl_capital_split.py (DELETE + recarga), que cambiaría los ids de
cliente_uni referenciados por persona y pisaría clientes creados en el panel.

Regla de precedencia: las filas con `editadoPanelAt` seteado (las tocó un
operador desde el panel) NUNCA se pisan con el espejo AS400 — el operador
manda. Eso congela el refresco de esa fila/ficha hasta que alguien limpie la
marca a proposito.

Fases (todas idempotentes):
  1. INSERT en cliente_uni de los capital que faltan (NOT EXISTS por idOriginal)
  2. INSERT de su cliente_direccion principal
  3. UPDATE de los scalars de cliente_uni capital desfasados (IS DISTINCT FROM)
  4. UPDATE de la copia de direccion (direccion, direccionBusq, geo, estado...)
     para los capital desfasados + backfill de direccionBusq en TODAS las filas
  5. Telefonos GXCALDTA.TELCLI para clientes capital sin telefonos
     (necesita AS400/jt400: se saltea con --sin-as400, p.ej. en el cron Linux)
  6. etl_persona_de_uno: persona para cada cliente_uni nuevo (personaId NULL)
  7. etl_direccion_norm: recalcula direccionTextoNorm (clave hogar) para todo

Uso:  python sync_cliente_uni.py [--sin-as400]
"""
import datetime as dt
import sys

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

import psycopg2
from psycopg2.extras import execute_values

from _creds import pg_conn_args

MONTEVIDEO = 100  # puestoId capital, igual que etl_capital_split

# Espejo SQL de busquedaNorm() (backend/src/common/direccion/normalize-direccion.ts):
# upper(translate(...)) debe producir lo mismo que NFD-strip + toUpperCase en TS.
ACENTOS = 'áéíóúàèìòùäëïöüâêîôûýÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÝñÑçÇ'
PLANOS = 'aeiouaeiouaeiouaeiouyAEIOUAEIOUAEIOUAEIOUYnNcC'

# Expresiones compartidas por las fases 2 y 4 (misma forma que etl_capital_split)
EXPR_BUSQ = 'upper(translate(c.direccion, %(acc)s, %(pla)s))'
EXPR_NRO = 'COALESCE(c."numeroPuertaGeo", NULLIF(c."numeroPuerta",0)::text)'


def fase1_insertar_uni(cur) -> int:
    cur.execute("""
        INSERT INTO cliente_uni
          (origen,"idOriginal",nombre,ruc,cedula,email,estado,"tipoClienteId",vip,
           observaciones,"observacionesComerc","tipoServicioId","gciNro",
           "fechaAlta","ultimaLlamada","operadorAlta","operadorModificacion",
           "createdAt","updatedAt")
        SELECT 'capital', c.id, c.nombre, c.ruc, NULL, c.email, c.estado,
               c."tipoId", c.vip, c.observaciones, c."observacionesComerciales",
               c."tipoServicioId", c."nroGci", c."fechaAlta",
               c."fechaUltimaLlamada", c."operadorAlta",
               c."operadorModificacion", now(), now()
        FROM cliente c
        WHERE NOT EXISTS (SELECT 1 FROM cliente_uni cu
                          WHERE cu.origen='capital' AND cu."idOriginal"=c.id)
    """)
    return cur.rowcount


def fase2_insertar_direcciones(cur) -> int:
    cur.execute(f"""
        INSERT INTO cliente_direccion
          ("clienteId","puestoId",direccion,"direccionBusq",calle,nro,
           bis,apto,"blockSolar",nivel,local,manzana,km,observaciones,
           lat,lng,"geoFuente","calleMatch","geoVerificadoAt",
           "direccionTextoNorm",principal,estado)
        SELECT cu.id, {MONTEVIDEO}, c.direccion, {EXPR_BUSQ},
               c."calleGeo", {EXPR_NRO},
               c.bis, c.apartamento, c."blockSolar", c.nivel, c.local,
               c."numeroManzana", c.km::text, c."observacionesDireccion",
               c."geoLat", c."geoLng", c."geoFuente", c."calleMatch",
               c."geoVerificadoAt", '', true, c.estado
        FROM cliente_uni cu
        JOIN cliente c ON c.id = cu."idOriginal"
        WHERE cu.origen='capital'
          AND NOT EXISTS (SELECT 1 FROM cliente_direccion d
                          WHERE d."clienteId" = cu.id)
    """, {'acc': ACENTOS, 'pla': PLANOS})
    return cur.rowcount


def fase3_refrescar_scalars(cur) -> int:
    cur.execute("""
        UPDATE cliente_uni cu SET
          nombre = c.nombre, ruc = c.ruc, email = c.email, estado = c.estado,
          "tipoClienteId" = c."tipoId", vip = c.vip,
          observaciones = c.observaciones,
          "observacionesComerc" = c."observacionesComerciales",
          "tipoServicioId" = c."tipoServicioId", "gciNro" = c."nroGci",
          "fechaAlta" = c."fechaAlta", "ultimaLlamada" = c."fechaUltimaLlamada",
          "operadorAlta" = c."operadorAlta",
          "operadorModificacion" = c."operadorModificacion",
          "updatedAt" = now()
        FROM cliente c
        WHERE cu.origen='capital' AND cu."idOriginal" = c.id
          AND cu."editadoPanelAt" IS NULL
          AND (cu.nombre, cu.ruc, cu.email, cu.estado, cu."tipoClienteId",
               cu.vip, cu.observaciones, cu."observacionesComerc",
               cu."tipoServicioId", cu."gciNro", cu."fechaAlta",
               cu."ultimaLlamada", cu."operadorAlta", cu."operadorModificacion")
              IS DISTINCT FROM
              (c.nombre, c.ruc, c.email, c.estado, c."tipoId", c.vip,
               c.observaciones, c."observacionesComerciales",
               c."tipoServicioId", c."nroGci", c."fechaAlta",
               c."fechaUltimaLlamada", c."operadorAlta",
               c."operadorModificacion")
    """)
    return cur.rowcount


def fase4_refrescar_direcciones(cur) -> tuple[int, int]:
    cur.execute(f"""
        UPDATE cliente_direccion d SET
          direccion = c.direccion, "direccionBusq" = {EXPR_BUSQ},
          calle = c."calleGeo", nro = {EXPR_NRO},
          bis = c.bis, apto = c.apartamento, "blockSolar" = c."blockSolar",
          nivel = c.nivel, local = c.local, manzana = c."numeroManzana",
          km = c.km::text, observaciones = c."observacionesDireccion",
          lat = c."geoLat", lng = c."geoLng", "geoFuente" = c."geoFuente",
          "calleMatch" = c."calleMatch", "geoVerificadoAt" = c."geoVerificadoAt",
          estado = c.estado
        FROM cliente_uni cu, cliente c
        WHERE d."clienteId" = cu.id AND d.principal
          AND d."editadoPanelAt" IS NULL
          AND cu.origen='capital' AND c.id = cu."idOriginal"
          AND (d.direccion, d."direccionBusq", d.calle, d.nro, d.bis, d.apto,
               d."blockSolar", d.nivel, d.local, d.manzana, d.km,
               d.observaciones, d.lat, d.lng, d."geoFuente", d."calleMatch",
               d."geoVerificadoAt", d.estado)
              IS DISTINCT FROM
              (c.direccion, {EXPR_BUSQ}, c."calleGeo", {EXPR_NRO}, c.bis,
               c.apartamento, c."blockSolar", c.nivel, c.local,
               c."numeroManzana", c.km::text, c."observacionesDireccion",
               c."geoLat", c."geoLng", c."geoFuente", c."calleMatch",
               c."geoVerificadoAt", c.estado)
    """, {'acc': ACENTOS, 'pla': PLANOS})
    capital = cur.rowcount

    # Interior y filas creadas por panel: solo mantener direccionBusq al dia.
    cur.execute("""
        UPDATE cliente_direccion SET
          "direccionBusq" = upper(translate(direccion, %(acc)s, %(pla)s))
        WHERE direccion IS NOT NULL
          AND "direccionBusq" IS DISTINCT FROM
              upper(translate(direccion, %(acc)s, %(pla)s))
    """, {'acc': ACENTOS, 'pla': PLANOS})
    return capital, cur.rowcount


def fase5_telefonos(cur, pg) -> tuple[int, int]:
    # Solo clientes capital espejo del AS400 que no tienen NINGUN telefono:
    # los ya cargados por etl_capital_tel no se tocan.
    cur.execute("""
        SELECT cu."idOriginal", cu.id FROM cliente_uni cu
        WHERE cu.origen='capital'
          AND EXISTS (SELECT 1 FROM cliente c WHERE c.id = cu."idOriginal")
          AND NOT EXISTS (SELECT 1 FROM cliente_telefono t
                          WHERE t."clienteId" = cu.id)
    """)
    faltan = {int(orig): uid for orig, uid in cur.fetchall()}
    if not faltan:
        return 0, 0

    # Import aca adentro: --sin-as400 corre en Linux sin jt400/JVM.
    import os
    if sys.platform == 'win32':
        os.environ.setdefault('JAVA_HOME', r'C:\Program Files\Java\jdk-21')
    import jaydebeapi
    from _creds import as400
    url, jar, props = as400()
    a = jaydebeapi.connect('com.ibm.as400.access.AS400JDBCDriver',
                           url, props, jar)
    ac = a.cursor()

    def s(v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    ids = sorted(faltan)
    insertados = 0
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        ac.execute('SELECT TELFNRO, CLIID, CLITELESTA, CLITELOBS '
                   'FROM GXCALDTA.TELCLI WHERE CLIID IN ('
                   + ','.join(str(x) for x in chunk) + ')')
        batch = []
        for tel, cliid, esta, obs in ac.fetchall():
            numero = s(tel)
            if not numero:
                continue
            batch.append((faltan[int(cliid)], numero[:20], s(esta),
                          s(obs)[:60] if s(obs) else None))
        if batch:
            execute_values(cur,
                'INSERT INTO cliente_telefono ("clienteId",numero,estado,obs,principal) VALUES %s',
                batch, template='(%s,%s,%s,%s,false)', page_size=5000)
            pg.commit()
            insertados += len(batch)
    ac.close(); a.close()
    return len(faltan), insertados


def main():
    t0 = dt.datetime.now()
    sin_as400 = '--sin-as400' in sys.argv

    pg = psycopg2.connect(**pg_conn_args())
    cur = pg.cursor()

    n = fase1_insertar_uni(cur); pg.commit()
    print(f'1. cliente_uni nuevos: {n:,}')
    n = fase2_insertar_direcciones(cur); pg.commit()
    print(f'2. cliente_direccion nuevas: {n:,}')
    n = fase3_refrescar_scalars(cur); pg.commit()
    print(f'3. cliente_uni refrescados: {n:,}')
    cap, busq = fase4_refrescar_direcciones(cur); pg.commit()
    print(f'4. direcciones refrescadas: {cap:,} (+{busq:,} solo direccionBusq)')

    if sin_as400:
        print('5. telefonos: salteado (--sin-as400)')
    else:
        clientes, tels = fase5_telefonos(cur, pg)
        print(f'5. telefonos: {tels:,} para {clientes:,} clientes sin telefono')

    cur.close(); pg.close()

    print('6. personas (etl_persona_de_uno):')
    import etl_persona_de_uno
    etl_persona_de_uno.main()

    print('7. direccionTextoNorm (etl_direccion_norm):')
    import etl_direccion_norm
    etl_direccion_norm.main()

    # Verificacion final: el espejo capital tiene que quedar 1:1 con la plana.
    pg = psycopg2.connect(**pg_conn_args())
    cur = pg.cursor()
    cur.execute("""SELECT count(*) FROM cliente c
                   WHERE NOT EXISTS (SELECT 1 FROM cliente_uni cu
                                     WHERE cu.origen='capital'
                                       AND cu."idOriginal"=c.id)""")
    sin_uni = cur.fetchone()[0]
    cur.execute("""SELECT count(*) FROM cliente_uni cu
                   WHERE cu.origen='capital'
                     AND NOT EXISTS (SELECT 1 FROM cliente_direccion d
                                     WHERE d."clienteId"=cu.id)""")
    sin_dir = cur.fetchone()[0]
    cur.execute('SELECT count(*) FROM cliente_uni WHERE "personaId" IS NULL')
    sin_persona = cur.fetchone()[0]
    cur.close(); pg.close()
    print(f'verificacion: sin_uni={sin_uni} sin_dir={sin_dir} sin_persona={sin_persona}')
    assert sin_uni == 0 and sin_dir == 0 and sin_persona == 0, 'sync incompleto'
    print(f'SYNC OK en {(dt.datetime.now() - t0).seconds}s')


if __name__ == '__main__':
    main()
