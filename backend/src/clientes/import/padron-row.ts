/**
 * Shape esperado de cada fila del dump legacy (AS400 → JSON).
 * Todos los campos son opcionales para tolerancia máxima.
 *
 * Ejemplo de objeto dump:
 * {
 *   "nroCliente": 1234,
 *   "nombre": "JUAN",
 *   "apellido": "PEREZ",
 *   "rutCi": "1.234.567-8",
 *   "gci": "GCI-001",
 *   "email": "juan@example.com",
 *   "tipo": "DOMESTICO",           // → TipoCliente
 *   "categoria": "RESIDENCIAL",    // → CategoriaCliente
 *   "estado": "ACTIVO",            // → EstadoCliente
 *   "fechaAlta": "2010-05-20",     // ISO 8601 o DD/MM/YYYY
 *   "fechaUltModif": "2023-01-01",
 *   "fechaUltCompra": null,
 *   "telefonos": [
 *     { "numero": "099111222", "tipo": "CELULAR", "esPrincipal": true }
 *   ],
 *   "direcciones": [
 *     {
 *       "calle": "18 DE JULIO",
 *       "nroPuerta": "1234",
 *       "esquina1": "ANDES",
 *       "apto": null,
 *       "zona": "ZONA1",
 *       "departamentoId": 1,
 *       "localidadId": 10,
 *       "esPrincipal": true
 *     }
 *   ]
 * }
 */
export interface PadronRow {
  nroCliente?: number | string | null;
  nombre?: string | null;
  apellido?: string | null;
  rutCi?: string | null;
  gci?: string | null;
  email?: string | null;
  tipo?: string | null;          // → TipoCliente enum
  categoria?: string | null;     // → CategoriaCliente enum
  estado?: string | null;        // → EstadoCliente enum
  fechaAlta?: string | null;
  fechaUltModif?: string | null;
  fechaUltCompra?: string | null;
  telefonos?: PadronTelefono[] | null;
  direcciones?: PadronDireccion[] | null;
  [key: string]: unknown;        // permite campos extra del dump sin romper
}

export interface PadronTelefono {
  numero?: string | null;
  tipo?: string | null;
  alias?: string | null;
  esPrincipal?: boolean | null;
}

export interface PadronDireccion {
  calle?: string | null;
  nroPuerta?: string | null;
  esquina1?: string | null;
  esquina2?: string | null;
  apto?: string | null;
  local?: string | null;
  zona?: string | null;
  departamentoId?: number | null;
  localidadId?: number | null;
  lat?: number | null;
  lng?: number | null;
  nivel?: string | null;
  esPrincipal?: boolean | null;
  enZona?: boolean | null;
}

import { DeepPartial } from 'typeorm';
import { Cliente } from '../entities/cliente.entity';
import { ClienteTelefono } from '../entities/cliente-telefono.entity';
import { ClienteDireccion } from '../entities/cliente-direccion.entity';
import { TipoCliente, CategoriaCliente, EstadoCliente } from '../enums';

/**
 * Parsea una fecha desde string (ISO 8601 o DD/MM/YYYY) de forma segura.
 * Retorna null si el valor es falsy o inválido.
 */
function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  // Intentar DD/MM/YYYY → YYYY-MM-DD
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(val);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Mapea una fila del dump legacy a DeepPartial<Cliente>.
 * Tolerante: campos faltantes o inválidos se convierten en null/defaults.
 */
export function mapPadronRowToCliente(row: PadronRow): DeepPartial<Cliente> {
  const nroCliente =
    row.nroCliente != null ? Number(row.nroCliente) : null;

  const tipoCliente: TipoCliente =
    row.tipo === TipoCliente.COMERCIAL
      ? TipoCliente.COMERCIAL
      : TipoCliente.DOMESTICO;

  const categoriaValores = Object.values(CategoriaCliente) as string[];
  const categoria: CategoriaCliente | null = row.categoria &&
    categoriaValores.includes(row.categoria.toUpperCase())
    ? (row.categoria.toUpperCase() as CategoriaCliente)
    : null;

  const estadoValores = Object.values(EstadoCliente) as string[];
  const estado: EstadoCliente =
    row.estado && estadoValores.includes(row.estado.toUpperCase())
      ? (row.estado.toUpperCase() as EstadoCliente)
      : EstadoCliente.ACTIVO;

  const telefonos: DeepPartial<ClienteTelefono>[] = (row.telefonos ?? [])
    .filter((t) => !!t.numero)
    .map((t) => ({
      numero: t.numero!.trim(),
      tipo: t.tipo ?? null,
      alias: t.alias ?? null,
      esPrincipal: t.esPrincipal ?? false,
      estado: 'ACTIVO',
    }));

  const direcciones: DeepPartial<ClienteDireccion>[] = (row.direcciones ?? [])
    .filter((d) => !!d.calle)
    .map((d) => ({
      calle: d.calle!.trim(),
      nroPuerta: d.nroPuerta ?? null,
      esquina1: d.esquina1 ?? null,
      esquina2: d.esquina2 ?? null,
      apto: d.apto ?? null,
      local: d.local ?? null,
      zona: d.zona ?? null,
      departamentoId: d.departamentoId ?? null,
      localidadId: d.localidadId ?? null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      nivel: d.nivel ?? null,
      esPrincipal: d.esPrincipal ?? false,
      enZona: d.enZona ?? null,
    }));

  return {
    nroCliente: isNaN(nroCliente as number) ? null : nroCliente,
    nombre: row.nombre?.trim() || 'SIN NOMBRE',
    apellido: row.apellido?.trim() ?? null,
    rutCi: row.rutCi?.trim() ?? null,
    gci: row.gci?.trim() ?? null,
    email: row.email?.trim() ?? null,
    tipoCliente,
    categoria,
    estado,
    fechaAlta: parseDate(row.fechaAlta),
    fechaUltModif: parseDate(row.fechaUltModif),
    fechaUltCompra: parseDate(row.fechaUltCompra),
    telefonos,
    direcciones,
  };
}
