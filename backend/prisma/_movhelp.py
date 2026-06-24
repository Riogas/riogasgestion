# -*- coding: utf-8 -*-
"""Helpers compartidos por los ETL de móviles/fleteras (merge 2026-06-24).
Conexión AS400 (jaydebeapi) + Postgres goya (psycopg2), conversión de coords
UTM 21S→WGS84 y coerciones de tipo. Reusa _creds (lee backend/.env)."""
import os
os.environ.setdefault('JAVA_HOME', r'C:\Program Files\Java\jdk-21')
import jaydebeapi
import psycopg2
from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from pyproj import Transformer
from _creds import as400, pg_conn_args

AS400_URL, AS400_JAR, AS400_PROPS = as400()
T_UTM = Transformer.from_crs(32721, 4326, always_xy=True)  # UTM 21S → WGS84


def as400_conn():
    return jaydebeapi.connect("com.ibm.as400.access.AS400JDBCDriver",
                              AS400_URL, AS400_PROPS, AS400_JAR)


def pg_conn():
    return psycopg2.connect(**pg_conn_args())


def s(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def i(v):
    try:
        return int(Decimal(str(v)))
    except (InvalidOperation, TypeError, ValueError):
        return None


def f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def boolSN(v):
    """'S'/'N' (o 1/0) → bool; None si vacío."""
    t = s(v)
    if t is None:
        return None
    t = t.upper()
    if t in ('S', '1', 'Y', 'T'):
        return True
    if t in ('N', '0', 'F'):
        return False
    return None


def fecha_yyyymmdd(v):
    """CHAR(8) 'YYYYMMDD' (o numérico) → date; None si inválido/0."""
    t = s(v)
    if not t:
        return None
    t = t.split('.')[0]
    if len(t) == 7:
        t = '0' + t
    if len(t) != 8 or t == '00000000':
        return None
    try:
        return date(int(t[0:4]), int(t[4:6]), int(t[6:8]))
    except ValueError:
        return None


def ts(v):
    """TIMESTAMP del AS400 → datetime; pasa-through si ya es datetime."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    t = s(v)
    if not t:
        return None
    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d-%H.%M.%S.%f',
                '%Y-%m-%d-%H.%M.%S'):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    return None


def utm_to_latlng(x, y):
    """MOVX/MOVY (UTM 21S) → (lat,lng) validado al rango Uruguay; (None,None) si fuera."""
    x, y = f(x), f(y)
    if not x or not y:
        return (None, None)
    lon, lat = T_UTM.transform(x, y)
    if -35.5 <= lat <= -30 and -59 <= lon <= -53:
        return (round(lat, 7), round(lon, 7))
    return (None, None)


def grados_to_latlng(x, y):
    """Coords interior MOVULTCOORDX/Y ya en grados; validar rango Uruguay (lat=X,lng=Y)."""
    x, y = f(x), f(y)
    if not x or not y:
        return (None, None)
    if -35.5 <= x <= -30 and -59 <= y <= -53:
        return (round(x, 7), round(y, 7))
    return (None, None)
