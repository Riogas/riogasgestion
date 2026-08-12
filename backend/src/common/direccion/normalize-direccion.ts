/**
 * Normalización de dirección → clave estable `direccionTextoNorm` (spec §5.1).
 * Implementación espejo: backend/prisma/_normdir.py DEBE producir la misma salida
 * (verificado contra backend/prisma/_fixtures/direccion_vectors.json en ambos lados).
 */

export const VIA_ABBR: Record<string, string> = {
  AVENIDA: 'AV',
  AVDA: 'AV',
  AV: 'AV',
  BULEVAR: 'BV',
  BVAR: 'BV',
  BR: 'BV',
  GENERAL: 'GRAL',
  GRAL: 'GRAL',
  DOCTOR: 'DR',
  DR: 'DR',
  CORONEL: 'CNEL',
  CNEL: 'CNEL',
  INGENIERO: 'ING',
  ING: 'ING',
  CAMINO: 'CNO',
  CNO: 'CNO',
  RUTA: 'RUTA',
  RTA: 'RUTA',
  CALLE: '',
};

const APTO_PREFIXES = ['APTO', 'AP', 'APARTAMENTO', 'UNIDAD'];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

function baseNormalize(s: string): string {
  const upper = stripAccents(s).toUpperCase();
  const sinPuntuacion = upper.replace(/[.,°º#-]/g, ' ');
  return sinPuntuacion.replace(/\s+/g, ' ').trim();
}

function canonVia(calleNorm: string): string {
  const tokens = calleNorm.split(' ').filter(Boolean);
  if (tokens.length === 0) return '';
  const [first, ...rest] = tokens;
  if (Object.prototype.hasOwnProperty.call(VIA_ABBR, first)) {
    return [VIA_ABBR[first], ...rest].filter(Boolean).join(' ');
  }
  return tokens.join(' ');
}

function canonNro(raw: string): string {
  const norm = baseNormalize(raw);
  const match = norm.match(/^(\d+)\s*(.*)$/);
  if (!match) return norm.replace(/\s+/g, '');
  const digits = match[1].replace(/^0+(?=\d)/, '');
  const sufijo = match[2].replace(/\s+/g, '');
  return digits + sufijo;
}

function canonApto(raw: string): string {
  const norm = baseNormalize(raw);
  const tokens = norm.split(' ').filter(Boolean);
  return tokens.filter((t) => !APTO_PREFIXES.includes(t)).join(' ');
}

/**
 * Normalización para búsqueda visible (`cliente_direccion.direccionBusq`):
 * la dirección completa sin tildes y en MAYÚSCULAS, sin tocar espacios ni
 * puntuación. Espejo SQL en sync_cliente_uni.py: upper(translate(...)) —
 * ambos DEBEN producir la misma salida para que el `contains` matchee.
 */
export function busquedaNorm(s: string): string {
  return stripAccents(s).toUpperCase();
}

export interface DireccionInput {
  departamentoId?: string | number | null;
  localidadId?: string | number | null;
  calle?: string | null;
  nro?: string | null;
  apto?: string | null;
}

export function normalizeDireccion(f: DireccionInput): string {
  if (!f || !f.calle || !f.nro) return '';

  const dep = f.departamentoId != null ? baseNormalize(String(f.departamentoId)) : '';
  const loc = f.localidadId != null ? baseNormalize(String(f.localidadId)) : '';

  const viaCanon = canonVia(baseNormalize(f.calle));
  const nroCanon = canonNro(f.nro);
  const callePart = [viaCanon, nroCanon].filter(Boolean).join(' ');

  const aptoCanon = f.apto ? canonApto(f.apto) : '';

  return `${dep}|${loc}|${callePart}|${aptoCanon}`;
}
