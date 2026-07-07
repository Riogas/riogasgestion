# -*- coding: utf-8 -*-
"""Test de vectores compartidos para normalize_direccion (mismo fixture que la spec TS)."""
import json
import pathlib

from _normdir import normalize_direccion

_fixture = pathlib.Path(__file__).resolve().parent / "_fixtures" / "direccion_vectors.json"


def main():
    vectors = json.loads(_fixture.read_text(encoding="utf-8"))
    for i, v in enumerate(vectors):
        got = normalize_direccion(**v["in"])
        assert got == v["out"], f"vector {i}: esperado {v['out']!r}, obtenido {got!r}"
    print("OK")


if __name__ == "__main__":
    main()
