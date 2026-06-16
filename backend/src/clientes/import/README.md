# Importador Padrón de Clientes (Fase 6)

## Dependencia pendiente externa

La **extracción desde AS400** (generar el archivo dump) es responsabilidad de un proceso externo que aún no está disponible. Este importador estará listo para correr en cuanto exista el archivo dump en formato JSON.

## Cómo correr

```bash
cd backend
pnpm import:padron --file=/ruta/al/padron.json
```

## Formato del dump JSON

El archivo debe ser un **array JSON** donde cada elemento es un objeto con la siguiente forma:

```json
[
  {
    "nroCliente": 1234,
    "nombre": "JUAN",
    "apellido": "PEREZ",
    "rutCi": "1.234.567-8",
    "gci": "GCI-001",
    "email": "juan@example.com",
    "tipo": "DOMESTICO",
    "categoria": "RESIDENCIAL",
    "estado": "ACTIVO",
    "fechaAlta": "2010-05-20",
    "fechaUltModif": "2023-01-01",
    "fechaUltCompra": null,
    "telefonos": [
      { "numero": "099111222", "tipo": "CELULAR", "esPrincipal": true }
    ],
    "direcciones": [
      {
        "calle": "18 DE JULIO",
        "nroPuerta": "1234",
        "esquina1": "ANDES",
        "zona": "ZONA1",
        "departamentoId": 1,
        "localidadId": 10,
        "esPrincipal": true
      }
    ]
  }
]
```

### Campos y tolerancias

| Campo | Tipo | Requerido | Default si ausente |
|---|---|---|---|
| `nroCliente` | number \| string | **SÍ** (clave UPSERT) | error → row a errores |
| `nombre` | string | No | `"SIN NOMBRE"` |
| `apellido` | string | No | `null` |
| `rutCi` | string | No | `null` |
| `gci` | string | No | `null` |
| `email` | string | No | `null` |
| `tipo` | `"DOMESTICO"` \| `"COMERCIAL"` | No | `"DOMESTICO"` |
| `categoria` | `"RESIDENCIAL"` \| `"COMERCIAL"` \| `"INDUSTRIAL"` | No | `null` |
| `estado` | `"ACTIVO"` \| `"INACTIVO"` \| `"PENDIENTE"` | No | `"ACTIVO"` |
| `fechaAlta` | string ISO 8601 o DD/MM/YYYY | No | `null` |
| `telefonos[].numero` | string | **SÍ para incluir el tel.** | teléfono filtrado |
| `direcciones[].calle` | string | **SÍ para incluir la dir.** | dirección filtrada |

## Idempotencia

- Si ya existe un cliente con ese `nroCliente` → **UPDATE** (merge de campos + reemplazo de relaciones).
- Si no existe → **CREATE**.
- Un row con error no frena los demás; se acumula en la lista de errores.

## Salida esperada

```
Importando 5000 filas desde /ruta/padron.json ...

=== RESULTADO DE IMPORTACIÓN ===
  Creados:      4800
  Actualizados: 150
  Errores:      50

--- ERRORES ---
  [1] nroCliente=9999: nroCliente requerido para UPSERT ...
  ...
```

Exit code 0 si no hay errores, 1 si hubo alguno.

## TODO

- [ ] Soporte CSV: acordar separador y columnas con el extractor AS400, luego implementar parser simple sin dependencias nuevas.
