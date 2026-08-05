// Captura silenciosa de señales del dispositivo para el formulario público de
// sorteos. TODO acá es best-effort: cualquier fallo devuelve lo que haya y
// jamás bloquea ni rompe el formulario (corre en WebViews de lectores QR,
// a veces sin secure context ni Clipboard/Crypto APIs).

export type DatosDispositivo = {
  fingerprint?: string;
  idioma?: string;
  plataforma?: string;
  resolucion?: string;
};

export type CoordenadasGps = { lat: number; lng: number };

/**
 * Tope duro para el GPS: el `timeout` de getCurrentPosition NO corre mientras
 * el prompt de permiso está abierto sin respuesta, así que este setTimeout
 * garantiza que la promesa siempre resuelva.
 */
const GPS_TOPE_MS = 7000;

function truncar(valor: string | undefined | null, max: number): string | undefined {
  if (!valor) return undefined;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, max) : undefined;
}

/** Firma de render 2D: varía por GPU/driver/fuentes y suma entropía al hash. */
function firmaCanvas(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 26;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#1E5BB8";
    ctx.fillRect(0, 0, 80, 26);
    ctx.textBaseline = "top";
    ctx.font = "13px Arial";
    ctx.fillStyle = "#FF7A1A";
    ctx.fillText("riogas-sorteo", 2, 4);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

async function sha256Hex(texto: string): Promise<string | undefined> {
  try {
    // WebViews sobre http plano no exponen crypto.subtle (secure context only).
    if (!globalThis.crypto?.subtle) return undefined;
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(texto),
    );
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

/** Junta las señales pasivas del dispositivo. Nunca rechaza. */
export async function capturarDispositivo(): Promise<DatosDispositivo> {
  const datos: DatosDispositivo = {};

  try {
    datos.idioma = truncar(navigator.language, 10);
  } catch {
    /* señal opcional */
  }

  try {
    const conUaData = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    datos.plataforma = truncar(
      conUaData.userAgentData?.platform || navigator.platform,
      60,
    );
  } catch {
    /* señal opcional */
  }

  try {
    datos.resolucion = truncar(`${screen.width}x${screen.height}`, 20);
  } catch {
    /* señal opcional */
  }

  try {
    const partes = [
      navigator.userAgent ?? "",
      navigator.language ?? "",
      `${screen.width}x${screen.height}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      firmaCanvas(),
    ];
    datos.fingerprint = await sha256Hex(partes.join("|"));
  } catch {
    /* sin fingerprint: se participa igual */
  }

  return datos;
}

/**
 * GPS best-effort: resuelve `null` ante rechazo, timeout, API ausente o prompt
 * de permiso sin respuesta. Nunca rechaza, nunca bloquea el formulario.
 */
export function capturarGps(): Promise<CoordenadasGps | null> {
  return new Promise((resolve) => {
    let resuelto = false;
    const terminar = (valor: CoordenadasGps | null) => {
      if (resuelto) return;
      resuelto = true;
      resolve(valor);
    };

    try {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        terminar(null);
        return;
      }

      const tope = setTimeout(() => terminar(null), GPS_TOPE_MS);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(tope);
          terminar({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(tope);
          terminar(null);
        },
        { timeout: 5000, maximumAge: 60000 },
      );
    } catch {
      terminar(null);
    }
  });
}
