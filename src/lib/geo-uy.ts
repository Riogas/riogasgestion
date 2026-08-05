// Normalización de la geolocalización de participaciones.
//
// Las dos fuentes del backend no hablan el mismo idioma: Nominatim (GPS)
// devuelve nombres ("Montevideo", "Canelones") y geoip-lite (IP) devuelve el
// código ISO-3166-2 ("MO", "CA"). Sin normalizar, el gráfico por departamento
// muestra dos barras para el mismo lugar y el popover mezcla "UY" con "Uruguay".

/** ISO-3166-2:UY → nombre del departamento. */
const DEPARTAMENTOS_UY: Record<string, string> = {
  AR: "Artigas",
  CA: "Canelones",
  CL: "Cerro Largo",
  CO: "Colonia",
  DU: "Durazno",
  FS: "Flores",
  FD: "Florida",
  LA: "Lavalleja",
  MA: "Maldonado",
  MO: "Montevideo",
  PA: "Paysandú",
  RN: "Río Negro",
  RV: "Rivera",
  RO: "Rocha",
  SA: "Salto",
  SJ: "San José",
  SO: "Soriano",
  TA: "Tacuarembó",
  TT: "Treinta y Tres",
};

/** Etiqueta para las participaciones sin departamento resuelto. */
export const SIN_UBICACION = "Sin ubicación precisa";

/** minúsculas, sin tildes y sin espacios de más: clave para comparar nombres. */
function clave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const DEPARTAMENTOS_POR_NOMBRE = new Map(
  Object.values(DEPARTAMENTOS_UY).map((nombre) => [clave(nombre), nombre]),
);

/**
 * Devuelve el nombre canónico del departamento: mapea el código ISO, corrige
 * tildes y mayúsculas de los nombres, y deja pasar tal cual lo que no reconoce
 * (una región de otro país sigue siendo información útil).
 */
export function normalizarDepartamento(valor: string | null | undefined): string {
  const limpio = (valor ?? "").trim();
  if (!limpio) return "";

  const codigo = limpio.toUpperCase();
  if (DEPARTAMENTOS_UY[codigo]) return DEPARTAMENTOS_UY[codigo];

  return DEPARTAMENTOS_POR_NOMBRE.get(clave(limpio)) ?? limpio;
}

/** "UY" → "Uruguay". Los nombres ya escritos se devuelven tal cual. */
export function normalizarPais(valor: string | null | undefined): string {
  const limpio = (valor ?? "").trim();
  if (!limpio) return "";
  if (!/^[a-z]{2}$/i.test(limpio)) return limpio;

  const codigo = limpio.toUpperCase();
  if (codigo === "UY") return "Uruguay";

  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}
