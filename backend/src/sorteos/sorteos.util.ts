import * as crypto from 'crypto';

export const CODIGO_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODIGO_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

export function generarCodigo(len = 12): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODIGO_ALPHABET[crypto.randomInt(CODIGO_ALPHABET.length)];
  return out;
}

export function formatearCanje(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function generarMomentos(cantidad: number, desde: Date, hasta: Date): Date[] {
  const span = hasta.getTime() - desde.getTime();
  const momentos = Array.from({ length: cantidad }, () => new Date(desde.getTime() + crypto.randomInt(0, Math.max(1, span))));
  return momentos.sort((a, b) => a.getTime() - b.getTime());
}

// Uruguay no tiene DST desde 2015: offset fijo UTC-3.
const MVD_OFFSET_MS = 3 * 60 * 60 * 1000;
export function inicioDiaMontevideo(ahora: Date): Date {
  const local = new Date(ahora.getTime() - MVD_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + MVD_OFFSET_MS);
}

/** Día calendario de Montevideo en formato YYYY-MM-DD. */
export function fechaMontevideo(fecha: Date): string {
  return new Date(fecha.getTime() - MVD_OFFSET_MS).toISOString().slice(0, 10);
}

/** Fecha y hora de Montevideo en formato YYYY-MM-DD HH:mm:ss (para el CSV). */
export function fechaHoraMontevideo(fecha: Date): string {
  return new Date(fecha.getTime() - MVD_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19);
}
