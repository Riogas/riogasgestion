// Respaldo del resultado ganador en `sessionStorage`.
//
// El código de canje solo existe en la respuesta de `/participar`: si el
// ganador recarga (o el WebView del lector de QR vuelve a montar la página),
// `/estado` responde `usado` y el premio desaparecía de la pantalla. Esto es
// SOLO recuperación de UI: la fuente de verdad sigue siendo el backend, y
// `sessionStorage` muere con la pestaña.
import type { SorteoPublico } from "./publicApi";

const CLAVE = "sorteo_resultado_ganador";

export type ResultadoGanadorGuardado = {
  codigoCanje: string;
  telefono: string;
  sorteo: SorteoPublico;
};

function esGuardado(valor: unknown): valor is ResultadoGanadorGuardado {
  if (typeof valor !== "object" || valor === null) return false;
  const r = valor as Partial<ResultadoGanadorGuardado>;
  return (
    typeof r.codigoCanje === "string" &&
    r.codigoCanje.length > 0 &&
    typeof r.telefono === "string" &&
    typeof r.sorteo?.nombre === "string" &&
    typeof r.sorteo?.premioDescripcion === "string" &&
    typeof r.sorteo?.edadMinima === "number"
  );
}

export function guardarResultadoGanador(resultado: ResultadoGanadorGuardado): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(resultado));
  } catch {
    // Modo privado / storage lleno: se sigue mostrando el resultado en memoria.
  }
}

export function leerResultadoGanador(): ResultadoGanadorGuardado | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const valor: unknown = JSON.parse(crudo);
    return esGuardado(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function olvidarResultadoGanador(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // noop
  }
}
