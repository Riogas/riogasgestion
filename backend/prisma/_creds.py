# -*- coding: utf-8 -*-
"""Credenciales para los scripts ETL / backfill, leídas de backend/.env (gitignoreado).
NO hardcodear secretos en los scripts. Variables esperadas en .env:
  DATABASE_URL  (postgres goya)
  AS400_URL, AS400_JAR, AS400_USER, AS400_PASS  (solo para los ETL que leen del AS400)
"""
import os
import pathlib
from urllib.parse import urlparse, unquote

_envp = pathlib.Path(__file__).resolve().parents[1] / ".env"  # backend/.env
if _envp.exists():
    for _ln in _envp.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"'))


def pg_conn_args():
    """psycopg2.connect(**pg_conn_args()) desde DATABASE_URL."""
    u = urlparse(os.environ["DATABASE_URL"].split("?")[0])
    return dict(host=u.hostname, port=u.port or 5432, dbname=u.path.lstrip("/"),
                user=unquote(u.username or ""), password=unquote(u.password or ""))


def as400():
    """(url, jar, props) para jaydebeapi.connect."""
    return (
        os.environ["AS400_URL"],
        os.environ["AS400_JAR"],
        {"user": os.environ["AS400_USER"], "password": os.environ["AS400_PASS"],
         "translate binary": "true"},
    )
