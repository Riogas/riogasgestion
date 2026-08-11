/**
 * Normalización de nombres de calle — port TS de `prisma/_normcalle.py`.
 * MISMA lógica que el batch de matching: si esto diverge, el suggest no
 * encuentra lo que el matcher guardó. Cualquier cambio va en los dos lados.
 */

const ABREVIATURAS: Record<string, string> = {
  AV: 'AVENIDA', AVD: 'AVENIDA', AVDA: 'AVENIDA',
  BV: 'BULEVAR', BVAR: 'BULEVAR', BVR: 'BULEVAR', BLVR: 'BULEVAR',
  BOULEVARD: 'BULEVAR', BULEVARD: 'BULEVAR',
  CNO: 'CAMINO', CAM: 'CAMINO',
  RBLA: 'RAMBLA', RLA: 'RAMBLA',
  PJE: 'PASAJE', PSJE: 'PASAJE',
  CALLEJ: 'CALLEJON', CJON: 'CALLEJON',
  DR: 'DOCTOR', DRA: 'DOCTORA',
  GRAL: 'GENERAL', GLLA: 'GENERAL',
  CNEL: 'CORONEL', TTE: 'TENIENTE', CAP: 'CAPITAN',
  SGTO: 'SARGENTO', ALTE: 'ALMIRANTE', CDTE: 'COMANDANTE',
  ING: 'INGENIERO', ARQ: 'ARQUITECTO', PROF: 'PROFESOR',
  PBRO: 'PRESBITERO', MTRO: 'MAESTRO', PTE: 'PRESIDENTE',
  STA: 'SANTA', STO: 'SANTO', SN: 'SAN',
  ESQ: 'ESQUINA', KM: 'KILOMETRO', RTA: 'RUTA',
};

const UNIDADES: Record<string, number> = {
  UNO: 1, PRIMERO: 1, DOS: 2, TRES: 3, CUATRO: 4, CINCO: 5,
  SEIS: 6, SIETE: 7, OCHO: 8, NUEVE: 9, DIEZ: 10, ONCE: 11,
  DOCE: 12, TRECE: 13, CATORCE: 14, QUINCE: 15,
  DIECISEIS: 16, DIECISIETE: 17, DIECIOCHO: 18, DIECINUEVE: 19,
  VEINTE: 20, VEINTIUNO: 21, VEINTIDOS: 22, VEINTITRES: 23,
  VEINTICUATRO: 24, VEINTICINCO: 25, VEINTISEIS: 26,
  VEINTISIETE: 27, VEINTIOCHO: 28, VEINTINUEVE: 29,
  TREINTA: 30, CUARENTA: 40, CINCUENTA: 50,
};
const DECENAS: Record<string, number> = { TREINTA: 30, CUARENTA: 40, CINCUENTA: 50 };

const MESES = new Set([
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
  'AGOSTO', 'SETIEMBRE', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]);

const TIPOS_VIA = new Set([
  'AVENIDA', 'CALLE', 'BULEVAR', 'CAMINO', 'RAMBLA', 'PASAJE', 'CALLEJON',
  'SENDA', 'DIAGONAL', 'CIRCUNVALACION', 'COSTANERA', 'PEATONAL', 'RUTA',
]);

export function quitarTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function reordenarSufijoComa(s: string): string {
  const m = s.match(/^(.*?),\s*(CNO|AV|AVDA|BVAR|PJE|RBLA|CAM)\.?\s*$/);
  return m ? `${m[2]} ${m[1]}` : s;
}

function sacarParentesis(s: string): string {
  return s.replace(/\(([^)]+)\)\s*$/, '').trim();
}

function palabrasANumeros(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    let valor: number | null = null;
    let consumidos = 1;
    if (
      DECENAS[t] !== undefined && i + 2 < tokens.length &&
      tokens[i + 1] === 'Y' && UNIDADES[tokens[i + 2]] !== undefined &&
      UNIDADES[tokens[i + 2]] < 10
    ) {
      valor = DECENAS[t] + UNIDADES[tokens[i + 2]];
      consumidos = 3;
    } else if (UNIDADES[t] !== undefined) {
      valor = UNIDADES[t];
    }
    if (valor !== null) {
      const esFecha =
        tokens[i + consumidos] === 'DE' && MESES.has(tokens[i + consumidos + 1] ?? '');
      if (esFecha || i === 0) {
        out.push(String(valor));
        i += consumidos;
        continue;
      }
    }
    out.push(t);
    i += 1;
  }
  return out;
}

export function normalizarCalle(nombre: string): string {
  if (!nombre) return '';
  let s = quitarTildes(nombre.toUpperCase().trim());
  s = sacarParentesis(s);
  s = reordenarSufijoComa(s);
  s = s.replace(/[^A-Z0-9\s]/g, ' ');
  let tokens = s.split(/\s+/).filter(Boolean);
  tokens = tokens.map((t) => ABREVIATURAS[t] ?? t);
  tokens = palabrasANumeros(tokens);
  return tokens.join(' ');
}

export function sinTipoVia(nombreNormalizado: string): string {
  const tokens = nombreNormalizado.split(' ').filter((t) => !TIPOS_VIA.has(t));
  return tokens.length ? tokens.join(' ') : nombreNormalizado;
}

// Títulos honoríficos civiles: presentación, no identidad. Los rangos
// militares NO se descartan ("General Flores" ≠ "Flores").
const HONORIFICOS = new Set([
  'DOCTOR', 'DOCTORA', 'INGENIERO', 'INGENIERA', 'ARQUITECTO', 'ARQUITECTA',
  'PROFESOR', 'PROFESORA', 'PRESBITERO', 'MAESTRO', 'MAESTRA', 'ESCRIBANO',
  'LICENCIADO', 'DON', 'DONA',
]);

/**
 * Clave terciaria: sin tipo de vía, sin honoríficos civiles y sin iniciales
 * sueltas. 'DOCTOR JOSE TERRA' y 'JOSE L TERRA' → 'JOSE TERRA'. Espejo de
 * `clave_esencial` en `prisma/_normcalle.py`.
 */
export function claveEsencial(nombreNormalizado: string): string {
  const tokens = nombreNormalizado
    .split(' ')
    .filter(
      (t) =>
        !TIPOS_VIA.has(t) && !HONORIFICOS.has(t) && !(t.length === 1 && /[A-Z]/.test(t)),
    );
  return tokens.length ? tokens.join(' ') : sinTipoVia(nombreNormalizado);
}

export function normalizarLugar(nombre: string): string {
  if (!nombre) return '';
  return quitarTildes(nombre.toUpperCase().trim())
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
