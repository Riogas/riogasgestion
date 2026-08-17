// Generación de los ejemplos copiables del portal /dashboard/docs.
//
// Funciones puras: reciben el endpoint, el ORIGEN del ambiente en el que está
// parado el navegador y los valores que el root cargó en el formulario, y
// devuelven texto. Nada de estado ni de `window` acá adentro — el origen entra
// por parámetro justamente para que esto se pueda testear.
//
// Por qué el origen se pasa y no se hardcodea: un ejemplo con una IP o con el
// host de dev pegado adentro es un ejemplo que alguien va a copiar y correr
// contra el ambiente equivocado. El visor le pasa `window.location.origin`, así
// que el curl que se copia en producción apunta a producción.
import type { EndpointVista } from "./vista";

export interface ValoresPrueba {
  /** Parámetros de path, por nombre (sin llaves). */
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  /** Cuerpo crudo, tal cual lo va a mandar el probador. */
  cuerpo: string;
}

export const VALORES_VACIOS: ValoresPrueba = { params: {}, query: {}, headers: {}, cuerpo: "" };

export interface Ambiente {
  nombre: string;
  esProd: boolean;
  host: string;
}

/**
 * Ambiente derivado del host, que es lo único confiable en el navegador: un
 * NEXT_PUBLIC_* puede haber quedado del build de otro ambiente, el host no.
 * Regla: si el host dice "dev" es DEV; localhost es LOCAL; cualquier otra cosa
 * se trata como PRODUCCIÓN — el default tiene que ser el que asusta.
 */
export function ambienteDeHost(host: string): Ambiente {
  const h = (host ?? "").toLowerCase();
  if (!h) return { nombre: "DESCONOCIDO", esProd: true, host: "" };
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h)) {
    return { nombre: "LOCAL", esProd: false, host: h };
  }
  if (h.includes("dev")) return { nombre: "DEV", esProd: false, host: h };
  return { nombre: "PRODUCCIÓN", esProd: true, host: h };
}

/** Sustituye el placeholder {origen} de los ejemplos escritos a mano. */
export function reemplazarOrigen(texto: string, origen: string): string {
  return (texto ?? "").split("{origen}").join(origen);
}

/** `/api/clientes/{id}` + {id: "123"} → `/api/clientes/123`. */
export function rutaConParams(ruta: string, params: Record<string, string>): string {
  return ruta.replace(/\{([^}]+)\}/g, (todo, nombre: string) => {
    const valor = params?.[nombre];
    return valor ? encodeURIComponent(valor).replace(/%2F/gi, "/") : todo;
  });
}

export function queryString(query: Record<string, string>): string {
  const partes = Object.entries(query ?? {})
    .filter(([clave, valor]) => clave.trim() !== "" && valor !== "")
    .map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`);
  return partes.length ? `?${partes.join("&")}` : "";
}

export function urlCompleta(origen: string, ep: EndpointVista, valores: ValoresPrueba): string {
  return `${origen}${rutaConParams(ep.ruta, valores.params)}${queryString(valores.query)}`;
}

/** Nombre de la variable de entorno con la key, para no escribirla en el ejemplo. */
export function variableDeKey(ep: EndpointVista): string {
  const explicita = ep.auth.match(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/);
  if (explicita) return explicita[1];
  if (/CallesApiKeyGuard/i.test(ep.auth)) return "CALLES_API_KEY";
  if (/SyncApiKeyGuard/i.test(ep.auth)) return "ZONAS_SYNC_API_KEY";
  if (/SorteosApiKeyGuard/i.test(ep.auth)) return "SORTEOS_PUBLIC_API_KEY";
  if (/MostradorApiKeyGuard/i.test(ep.auth)) return "MOSTRADOR_API_KEY";
  return "API_KEY";
}

/** Headers que el ejemplo tiene que llevar sí o sí para que la llamada entre. */
export function headersDeAuth(ep: EndpointVista): Record<string, string> {
  switch (ep.categoriaAuth) {
    case "jwt":
    case "root":
      return { Authorization: "Bearer $TOKEN" };
    case "sesion":
      return { Authorization: "Bearer $TOKEN_SESION" };
    case "api-key":
      return { "x-api-key": `$${variableDeKey(ep)}` };
    default:
      return {};
  }
}

function headersFinales(ep: EndpointVista, valores: ValoresPrueba): Record<string, string> {
  const headers: Record<string, string> = { ...headersDeAuth(ep) };
  if (ep.cuerpo) headers["Content-Type"] = ep.cuerpo.contentType || "application/json";
  for (const [clave, valor] of Object.entries(valores.headers ?? {})) {
    if (clave.trim()) headers[clave] = valor;
  }
  return headers;
}

/** ¿La respuesta se lee como texto plano? (el `formato=texto` pipe-delimited del VB6) */
function respuestaEsTexto(ep: EndpointVista, valores: ValoresPrueba): boolean {
  return valores.query?.formato === "texto" || /pipe|texto plano/i.test(ep.resumen);
}

function cuerpoParaEjemplo(ep: EndpointVista, valores: ValoresPrueba): string {
  if (!ep.cuerpo) return "";
  const crudo = (valores.cuerpo ?? "").trim();
  if (crudo) return crudo;
  return ep.cuerpo.esqueleto || "{}";
}

/** Comilla simple para shell: la única forma segura es cerrar, escapar y reabrir. */
function comillaShell(texto: string): string {
  return `'${texto.split("'").join(`'\\''`)}'`;
}

export function ejemploCurl(ep: EndpointVista, origen: string, valores: ValoresPrueba): string {
  const lineas: string[] = [`curl -i -X ${ep.metodo} \\`];
  for (const [clave, valor] of Object.entries(headersFinales(ep, valores))) {
    lineas.push(`  -H ${comillaShell(`${clave}: ${valor}`)} \\`);
  }
  if (ep.esEscritura && ep.cuerpo) {
    lineas.push(`  -d ${comillaShell(cuerpoParaEjemplo(ep, valores))} \\`);
  }
  lineas.push(`  ${comillaShell(urlCompleta(origen, ep, valores))}`);
  return lineas.join("\n");
}

export function ejemploFetch(ep: EndpointVista, origen: string, valores: ValoresPrueba): string {
  const headers = headersFinales(ep, valores);
  const lineas: string[] = [];
  lineas.push(`const resp = await fetch(${JSON.stringify(urlCompleta(origen, ep, valores))}, {`);
  lineas.push(`  method: ${JSON.stringify(ep.metodo)},`);
  if (Object.keys(headers).length) {
    lineas.push("  headers: {");
    for (const [clave, valor] of Object.entries(headers)) {
      lineas.push(`    ${JSON.stringify(clave)}: ${JSON.stringify(valor)},`);
    }
    lineas.push("  },");
  }
  if (ep.esEscritura && ep.cuerpo) {
    lineas.push(`  body: ${JSON.stringify(cuerpoParaEjemplo(ep, valores))},`);
  }
  lineas.push("});");
  lineas.push("");
  lineas.push("if (!resp.ok) throw new Error(`HTTP ${resp.status}`);");
  lineas.push(
    respuestaEsTexto(ep, valores)
      ? "const datos = await resp.text(); // pipe-delimited, una línea por fila"
      : "const datos = await resp.json();",
  );
  return lineas.join("\n");
}

/** ¿Alguno de los consumidores anotados es el VB6? */
export function usaVb6(ep: EndpointVista): boolean {
  return ep.consumidores.some((c) => /vb6|visual basic/i.test(c));
}

/**
 * Ejemplo para el VB6, que es el consumidor que no parsea JSON: por eso los
 * endpoints de calles tienen `formato=texto` (líneas `campo|campo|campo`).
 * MSXML2.ServerXMLHTTP y no XMLHTTP: el primero no usa la caché de WinINet ni
 * la configuración de proxy del usuario logueado.
 */
export function ejemploVb6(ep: EndpointVista, origen: string, valores: ValoresPrueba): string {
  const texto = respuestaEsTexto(ep, valores);
  const url = urlCompleta(origen, ep, valores);
  const lineas: string[] = [
    "Dim http As Object",
    'Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")',
    "",
    `http.Open "${ep.metodo}", "${url}", False`,
  ];
  for (const [clave, valor] of Object.entries(headersFinales(ep, valores))) {
    const valorVb = valor.startsWith("$") ? valor.slice(1) : `"${valor}"`;
    lineas.push(`http.setRequestHeader "${clave}", ${valorVb}`);
  }
  if (ep.esEscritura && ep.cuerpo) {
    const cuerpo = cuerpoParaEjemplo(ep, valores).replace(/\r?\n\s*/g, " ").split('"').join('""');
    lineas.push(`http.Send "${cuerpo}"`);
  } else {
    lineas.push("http.Send");
  }
  lineas.push("");
  lineas.push("If http.Status <> 200 Then");
  lineas.push('    MsgBox "Error " & http.Status & ": " & http.responseText');
  lineas.push("    Exit Sub");
  lineas.push("End If");
  if (texto) {
    lineas.push("");
    lineas.push("Dim filas() As String, campos() As String, i As Long");
    lineas.push("filas = Split(http.responseText, vbLf)");
    lineas.push("For i = LBound(filas) To UBound(filas)");
    lineas.push('    If Len(Trim$(filas(i))) > 0 Then');
    lineas.push('        campos = Split(filas(i), "|")');
    lineas.push("        ' campos(0) = CALID, campos(1) = nombre, ...");
    lineas.push("    End If");
    lineas.push("Next i");
  } else {
    lineas.push("");
    lineas.push("' http.responseText trae el JSON: parsealo con el módulo JSON del proyecto.");
  }
  return lineas.join("\n");
}

export interface EjemploGenerado {
  clave: string;
  titulo: string;
  lenguaje: string;
  codigo: string;
}

/** Los ejemplos que muestra el visor: los generados + los escritos a mano. */
export function ejemplosDe(
  ep: EndpointVista,
  origen: string,
  valores: ValoresPrueba = VALORES_VACIOS,
): EjemploGenerado[] {
  const salida: EjemploGenerado[] = [
    { clave: "curl", titulo: "curl", lenguaje: "bash", codigo: ejemploCurl(ep, origen, valores) },
    {
      clave: "fetch",
      titulo: "fetch (JS)",
      lenguaje: "javascript",
      codigo: ejemploFetch(ep, origen, valores),
    },
  ];
  if (usaVb6(ep)) {
    salida.push({
      clave: "vb6",
      titulo: "VB6",
      lenguaje: "vb",
      codigo: ejemploVb6(ep, origen, valores),
    });
  }
  ep.ejemplos.forEach((e, i) => {
    salida.push({
      clave: `anotado-${i}`,
      titulo: e.titulo,
      lenguaje: e.lenguaje,
      codigo: reemplazarOrigen(e.codigo, origen),
    });
  });
  return salida;
}
