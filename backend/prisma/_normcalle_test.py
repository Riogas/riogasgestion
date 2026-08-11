# -*- coding: utf-8 -*-
"""Tests de la normalización — casos REALES de los dos mundos."""
import sys

sys.stdout.reconfigure(encoding='utf-8')
from _normcalle import (
    es_calle_real,
    extraer_parentesis,
    normalizar_calle,
    normalizar_lugar,
    sin_tipo_via,
)

CASOS = [
    # (nomenclator, osm, deben_coincidir)
    ('AVENIDA DIECIOCHO DE JULIO', '18 de Julio', False),  # exacto no; sin_tipo_via sí
    ('AVENIDA DIECIOCHO DE JULIO', 'Avenida 18 de Julio', True),
    ('AVENIDA OCHO DE OCTUBRE', 'Avenida 8 de Octubre', True),
    ('BOULEVARD GENERAL ARTIGAS', 'Bulevar Gral. Artigas', True),
    ('BOULEVARD JOSE BATLLE Y ORDOÑEZ', 'Bulevar José Batlle y Ordóñez', True),
    ('AVENIDA DOCTOR LUIS ALBERTO DE HERRERA', 'Avenida Dr. Luis Alberto de Herrera', True),
    ('A LAS PIEDRAS,CNO. (PROGRESO)', 'Camino a Las Piedras', True),
    ('ÑANDUBAY (PROGRESO)', 'Ñandubay', True),
    ('TREINTA Y TRES', '33', True),  # la calle Treinta y Tres
    ('VEINTICINCO DE MAYO', '25 de Mayo', True),
    ('CUFRE', 'Cufré', True),
    ('AVENIDA GENERAL RIVERA', 'Avenida General Fructuoso Rivera', False),  # fuzzy, no exacto
]


def correr():
    fallos = 0
    for nom, osm, esperado in CASOS:
        a, b = normalizar_calle(nom), normalizar_calle(osm)
        ok = (a == b) == esperado
        estado = 'OK ' if ok else 'FALLO'
        if not ok:
            fallos += 1
        print(f'{estado} [{nom}] -> [{a}]  vs  [{osm}] -> [{b}]')

    # Prefijo del número por contexto: al inicio o antes de mes
    assert normalizar_calle('DIECIOCHO DE JULIO') == '18 DE JULIO'
    assert normalizar_calle('CALLE DIECIOCHO') == 'CALLE DIECIOCHO', 'sin contexto no convierte'

    # Paréntesis como pista de localidad
    base, pista = extraer_parentesis('ÑANDUBAY (PROGRESO)')
    assert base == 'ÑANDUBAY' and pista == 'PROGRESO'

    # Lugares
    assert normalizar_lugar('Paysandú') == normalizar_lugar('PAYSANDU')
    assert normalizar_lugar('Las Piedras') == 'LAS PIEDRAS'

    # Filtro de no-calles
    assert not es_calle_real('SIN NOMBRE')
    assert es_calle_real('Cufré')

    # La clave secundaria empareja cuando solo difiere el tipo de vía
    assert sin_tipo_via(normalizar_calle('AVENIDA DIECIOCHO DE JULIO')) == \
        sin_tipo_via(normalizar_calle('18 de Julio'))
    assert sin_tipo_via(normalizar_calle('BOULEVARD GENERAL ARTIGAS')) == \
        sin_tipo_via(normalizar_calle('Bulevar Gral. Artigas'))

    print(f'\n{"TODO OK" if fallos == 0 else f"{fallos} FALLOS"}')
    return fallos


if __name__ == '__main__':
    sys.exit(1 if correr() else 0)
