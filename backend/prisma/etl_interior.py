# -*- coding: utf-8 -*-
"""INTERIOR: PUESTOS.CLIENTE (AS400) -> cliente_uni (origen='interior') + cliente_direccion (embebida).
Identidad: (origen, idOriginal=CLIID, idOriginalPuesto=CLIPUESTOID). Re-ejecutable.
La dirección 1:N de PUESTOS.CLIENTEDIRECCION queda como enriquecimiento follow-up."""
import os
os.environ['JAVA_HOME'] = r'C:\Program Files\Java\jdk-21'
import jaydebeapi
import psycopg2
from psycopg2.extras import execute_values
from decimal import Decimal, InvalidOperation
from pyproj import Transformer
from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()
T_UTM = Transformer.from_crs(32721, 4326, always_xy=True)


def s(v):
    if v is None: return None
    v = str(v).strip(); return v or None

def f(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def i(v):
    try: return int(Decimal(str(v)))
    except (InvalidOperation, TypeError, ValueError): return None

def vip(v):
    try: return int(Decimal(str(v))) == 1
    except Exception: return None

def latlng(x, y):
    x, y = f(x), f(y)
    if not x or not y: return (None, None)
    if abs(x) < 90 and -59 <= y <= -53 and -35.5 <= x <= -30:   # X=lat,Y=lng
        return (round(x, 7), round(y, 7))
    if x > 1000:                                                  # UTM 21S
        lon, lat = T_UTM.transform(x, y)
        if -35.5 <= lat <= -30 and -59 <= lon <= -53: return (round(lat, 7), round(lon, 7))
    return (None, None)

def direccion_txt(calle, nro, esq1, esq2, solar, apto, km, manz):
    parts = []
    base = (s(calle) or '').strip()
    if nro: base = (base + ' ' + str(nro)).strip()
    if base: parts.append(base)
    es = [s(e) for e in (esq1, esq2) if s(e)]
    if es: parts.append('esq. ' + ' y '.join(es))
    if s(solar): parts.append('Solar ' + s(solar))
    if s(manz): parts.append('Mz ' + s(manz))
    if s(apto): parts.append('Apto ' + s(apto))
    if km: parts.append('Km ' + str(km))
    return ', '.join(parts)[:300] or None


def main():
    p = psycopg2.connect(**pg_conn_args()); pc = p.cursor()
    pc.execute("DELETE FROM cliente_direccion WHERE \"clienteId\" IN (SELECT id FROM cliente_uni WHERE origen='interior')")
    pc.execute("DELETE FROM cliente_uni WHERE origen='interior'")
    p.commit()

    a = jaydebeapi.connect("com.ibm.as400.access.AS400JDBCDriver", AS400_URL, AS400_PROPS, AS400_JAR)
    ac = a.cursor()
    ac.execute("""SELECT CLIPUESTOID,CLIID,CLINOM,CLIRUC,CLIMAIL,CLIESTADO,CLITPOCLIID,CLIVIP,CLIOBS,
        CLIPUNTOSSALDO,CLIFLETECOBRA,CLIFLETECANTIDAD,CLICATPRECIOID,CLIFCHALTA,CLIULTLLAMADA,CLIOPINS,CLIOPUPD,
        CALPRINNOM,CLINROPUERTA,CALESQ1NOM,CALESQ2NOM,CLIBIS,CLIAPTO,CLIBLOCKSOL,CLINIVEL,CLILOCAL,CLINROMANZ,
        CLIKM,CLIDIROBS,DEPARTAMENTOID,CIUDADID,CLICOORDX,CLICOORDY FROM PUESTOS.CLIENTE""")
    rows = ac.fetchall(); ac.close(); a.close()
    print("leídos PUESTOS.CLIENTE:", len(rows))

    # Phase A: cliente_uni
    uni = []
    for r in rows:
        uni.append(('interior', i(r[1]), i(r[0]), s(r[2]), s(r[3]) if i(r[3]) else None, None, s(r[4]), s(r[5]),
                    i(r[6]), vip(r[7]), s(r[8]), i(r[9]), s(r[10]), s(r[11]), i(r[12]),
                    s(r[13]), s(r[14]), s(r[15]), s(r[16])))
    execute_values(pc,
        'INSERT INTO cliente_uni (origen,"idOriginal","idOriginalPuesto",nombre,ruc,cedula,email,estado,'
        '"tipoClienteId",vip,observaciones,"puntosSaldo","fleteCobra","fleteCantidad","categoriaPrecioId",'
        '"fechaAlta","ultimaLlamada","operadorAlta","operadorModificacion","createdAt","updatedAt") '
        'VALUES %s',
        uni, template='(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())', page_size=3000)
    p.commit()
    print("cliente_uni interior:", pc.rowcount if pc.rowcount>0 else len(uni))

    # map (idOriginal,idOriginalPuesto) -> id
    pc.execute("SELECT \"idOriginal\",\"idOriginalPuesto\",id FROM cliente_uni WHERE origen='interior'")
    idmap = {(int(a_), int(b_)): c_ for a_, b_, c_ in pc.fetchall()}

    # Phase B: cliente_direccion embebida
    dirs = []
    for r in rows:
        key = (i(r[1]), i(r[0]))
        cid = idmap.get(key)
        if cid is None: continue
        lat, lng = latlng(r[31], r[32])
        nro = i(r[18])
        dirs.append((cid, i(r[0]), i(r[29]), i(r[30]),
                     direccion_txt(r[17], nro, r[19], r[20], r[23], r[22], i(r[27]), r[26]),
                     s(r[17]), str(nro) if nro else None, s(r[19]), s(r[20]), s(r[21]), s(r[22]),
                     s(r[23]), s(r[24]), s(r[25]), s(r[26]), str(i(r[27])) if i(r[27]) else None, s(r[28]),
                     lat, lng, 'interior', True, s(r[5])))
    execute_values(pc,
        'INSERT INTO cliente_direccion ("clienteId","puestoId","departamentoId","localidadId",direccion,'
        'calle,nro,esquina1,esquina2,bis,apto,"blockSolar",nivel,local,manzana,km,observaciones,'
        'lat,lng,"geoFuente",principal,estado) VALUES %s',
        dirs, template='(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', page_size=3000)
    p.commit()
    print("cliente_direccion interior:", len(dirs))

    pc.execute("SELECT count(*) FROM cliente_uni WHERE origen='interior'"); print("  uni:", pc.fetchone()[0])
    pc.execute("""SELECT cu.nombre, d.direccion, d.lat FROM cliente_uni cu JOIN cliente_direccion d ON d."clienteId"=cu.id
                  WHERE cu.origen='interior' AND d.direccion IS NOT NULL LIMIT 3""")
    for x in pc.fetchall(): print("  sample:", x)
    pc.close(); p.close(); print("OK interior")


if __name__ == '__main__':
    main()
