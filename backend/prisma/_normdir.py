# -*- coding: utf-8 -*-
"""Normalización de dirección → clave estable `direccionTextoNorm` (spec §5.1).
Mirror Python de backend/src/common/direccion/normalize-direccion.ts.
Ambas implementaciones DEBEN producir la misma salida (ver _fixtures/direccion_vectors.json)."""
import re
import unicodedata

VIA_ABBR = {
    "AVENIDA": "AV",
    "AVDA": "AV",
    "AV": "AV",
    "BULEVAR": "BV",
    "BVAR": "BV",
    "BR": "BV",
    "GENERAL": "GRAL",
    "GRAL": "GRAL",
    "DOCTOR": "DR",
    "DR": "DR",
    "CORONEL": "CNEL",
    "CNEL": "CNEL",
    "INGENIERO": "ING",
    "ING": "ING",
    "CAMINO": "CNO",
    "CNO": "CNO",
    "RUTA": "RUTA",
    "RTA": "RUTA",
    "CALLE": "",
}

APTO_PREFIXES = {"APTO", "AP", "APARTAMENTO", "UNIDAD"}


def _strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _base_normalize(s):
    upper = _strip_accents(s).upper()
    sin_puntuacion = re.sub(r"[.,°º#-]", " ", upper)
    return re.sub(r"\s+", " ", sin_puntuacion).strip()


def _canon_via(calle_norm):
    tokens = [t for t in calle_norm.split(" ") if t]
    if not tokens:
        return ""
    first, resto = tokens[0], tokens[1:]
    if first in VIA_ABBR:
        return " ".join([t for t in [VIA_ABBR[first]] + resto if t])
    return " ".join(tokens)


def _canon_nro(raw):
    norm = _base_normalize(raw)
    m = re.match(r"^(\d+)\s*(.*)$", norm)
    if not m:
        return re.sub(r"\s+", "", norm)
    digitos = re.sub(r"^0+(?=\d)", "", m.group(1))
    sufijo = re.sub(r"\s+", "", m.group(2))
    return digitos + sufijo


def _canon_apto(raw):
    norm = _base_normalize(raw)
    tokens = [t for t in norm.split(" ") if t]
    return " ".join(t for t in tokens if t not in APTO_PREFIXES)


def normalize_direccion(departamentoId=None, localidadId=None, calle=None, nro=None, apto=None):
    if not calle or not nro:
        return ""

    dep = _base_normalize(str(departamentoId)) if departamentoId is not None else ""
    loc = _base_normalize(str(localidadId)) if localidadId is not None else ""

    via_canon = _canon_via(_base_normalize(calle))
    nro_canon = _canon_nro(nro)
    calle_part = " ".join(p for p in [via_canon, nro_canon] if p)

    apto_canon = _canon_apto(apto) if apto else ""

    return f"{dep}|{loc}|{calle_part}|{apto_canon}"
