# -*- coding: utf-8 -*-
"""Normalización de nombres de calle para el puente nomenclator<->OSM.

El nomenclator escribe "AVENIDA DIECIOCHO DE JULIO", "A LAS PIEDRAS,CNO. (PROGRESO)".
OSM escribe "18 de Julio", "Camino a Las Piedras". Este módulo lleva ambos
mundos a una misma forma canónica comparable: MAYÚSCULAS, sin tildes, sin
puntuación, abreviaturas expandidas y números SIEMPRE en cifras.
"""
import re
import unicodedata

# Abreviatura (ya sin puntos) -> forma canónica
ABREVIATURAS = {
    'AV': 'AVENIDA', 'AVD': 'AVENIDA', 'AVDA': 'AVENIDA',
    'BV': 'BULEVAR', 'BVAR': 'BULEVAR', 'BVR': 'BULEVAR', 'BLVR': 'BULEVAR',
    'BOULEVARD': 'BULEVAR', 'BULEVARD': 'BULEVAR',
    'CNO': 'CAMINO', 'CAM': 'CAMINO',
    'RBLA': 'RAMBLA', 'RLA': 'RAMBLA',
    'PJE': 'PASAJE', 'PSJE': 'PASAJE',
    'CALLEJ': 'CALLEJON', 'CJON': 'CALLEJON',
    'DR': 'DOCTOR', 'DRA': 'DOCTORA',
    'GRAL': 'GENERAL', 'GLLA': 'GENERAL',
    'CNEL': 'CORONEL', 'TTE': 'TENIENTE', 'CAP': 'CAPITAN',
    'SGTO': 'SARGENTO', 'ALTE': 'ALMIRANTE', 'CDTE': 'COMANDANTE',
    'ING': 'INGENIERO', 'ARQ': 'ARQUITECTO', 'PROF': 'PROFESOR',
    'PBRO': 'PRESBITERO', 'MTRO': 'MAESTRO', 'PTE': 'PRESIDENTE',
    'STA': 'SANTA', 'STO': 'SANTO', 'SN': 'SAN',
    'ESQ': 'ESQUINA', 'KM': 'KILOMETRO', 'RTA': 'RUTA',
}

_UNIDADES = {
    'UNO': 1, 'PRIMERO': 1, 'DOS': 2, 'TRES': 3, 'CUATRO': 4, 'CINCO': 5,
    'SEIS': 6, 'SIETE': 7, 'OCHO': 8, 'NUEVE': 9, 'DIEZ': 10, 'ONCE': 11,
    'DOCE': 12, 'TRECE': 13, 'CATORCE': 14, 'QUINCE': 15,
    'DIECISEIS': 16, 'DIECISIETE': 17, 'DIECIOCHO': 18, 'DIECINUEVE': 19,
    'VEINTE': 20, 'VEINTIUNO': 21, 'VEINTIDOS': 22, 'VEINTITRES': 23,
    'VEINTICUATRO': 24, 'VEINTICINCO': 25, 'VEINTISEIS': 26,
    'VEINTISIETE': 27, 'VEINTIOCHO': 28, 'VEINTINUEVE': 29,
    'TREINTA': 30, 'CUARENTA': 40, 'CINCUENTA': 50,
}
_DECENAS = {'TREINTA': 30, 'CUARENTA': 40, 'CINCUENTA': 50}

# Meses: si un número-en-palabras va seguido de "DE <MES>", casi seguro es
# una fecha patria y la conversión a cifra es correcta (18 DE JULIO).
_MESES = {
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
    'AGOSTO', 'SETIEMBRE', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
}

# Nombres que NO son calles reales en el nomenclator.
NO_CALLES = {'SIN NOMBRE', 'SIN DATO', 'S N', 'SN'}


def quitar_tildes(s: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )


def _reordenar_sufijo_coma(s: str) -> str:
    """'A LAS PIEDRAS,CNO.' -> 'CNO. A LAS PIEDRAS' (formato del nomenclator)."""
    m = re.match(r'^(.*?),\s*(CNO|AV|AVDA|BVAR|PJE|RBLA|CAM)\.?\s*$', s)
    if m:
        return f'{m.group(2)} {m.group(1)}'
    return s


def extraer_parentesis(s: str) -> tuple[str, str | None]:
    """'ÑANDUBAY (PROGRESO)' -> ('ÑANDUBAY', 'PROGRESO'). La pista es localidad."""
    m = re.search(r'\(([^)]+)\)\s*$', s)
    if not m:
        return s.strip(), None
    return s[: m.start()].strip(), m.group(1).strip()


def _palabras_a_numeros(tokens: list[str]) -> list[str]:
    """DIECIOCHO -> 18. Maneja 'TREINTA Y TRES'. Solo convierte cuando el
    contexto lo avala: seguido de 'DE <MES>' o al inicio del nombre."""
    out: list[str] = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        valor = None
        consumidos = 1
        if t in _DECENAS and i + 2 < len(tokens) and tokens[i + 1] == 'Y' \
                and tokens[i + 2] in _UNIDADES and _UNIDADES[tokens[i + 2]] < 10:
            valor = _DECENAS[t] + _UNIDADES[tokens[i + 2]]
            consumidos = 3
        elif t in _UNIDADES:
            valor = _UNIDADES[t]

        if valor is not None:
            resto = tokens[i + consumidos:i + consumidos + 2]
            es_fecha = len(resto) >= 2 and resto[0] == 'DE' and resto[1] in _MESES
            if es_fecha or i == 0:
                out.append(str(valor))
                i += consumidos
                continue
        out.append(t)
        i += 1
    return out


def normalizar_calle(nombre: str) -> str:
    """La forma canónica comparable de un nombre de calle, de cualquiera de
    los dos mundos."""
    if not nombre:
        return ''
    s = quitar_tildes(nombre.upper().strip())
    # Primero el paréntesis (queda al final) y recién después el sufijo con
    # coma: 'A LAS PIEDRAS,CNO. (PROGRESO)' -> 'A LAS PIEDRAS,CNO.' -> 'CNO A LAS PIEDRAS'.
    s, _ = extraer_parentesis(s)
    s = _reordenar_sufijo_coma(s)
    s = re.sub(r'[^A-Z0-9\s]', ' ', s)
    tokens = [t for t in s.split() if t]
    tokens = [ABREVIATURAS.get(t, t) for t in tokens]
    tokens = _palabras_a_numeros(tokens)
    return ' '.join(tokens)


# Tipos de vía: se sacan para la clave secundaria. "AVENIDA 18 DE JULIO" y
# "18 DE JULIO" son la misma calle; el tipo de vía es presentación.
TIPOS_VIA = {
    'AVENIDA', 'CALLE', 'BULEVAR', 'CAMINO', 'RAMBLA', 'PASAJE', 'CALLEJON',
    'SENDA', 'DIAGONAL', 'CIRCUNVALACION', 'COSTANERA', 'PEATONAL', 'RUTA',
}


def sin_tipo_via(nombre_normalizado: str) -> str:
    """Clave secundaria: la forma canónica SIN los tokens de tipo de vía."""
    tokens = [t for t in nombre_normalizado.split() if t not in TIPOS_VIA]
    return ' '.join(tokens) if tokens else nombre_normalizado


def normalizar_lugar(nombre: str) -> str:
    """Para localidades/ciudades: sin tildes, mayúsculas, sin puntuación."""
    if not nombre:
        return ''
    s = quitar_tildes(nombre.upper().strip())
    s = re.sub(r'[^A-Z0-9\s]', ' ', s)
    return ' '.join(s.split())


def es_calle_real(nombre: str) -> bool:
    return normalizar_calle(nombre) not in NO_CALLES
