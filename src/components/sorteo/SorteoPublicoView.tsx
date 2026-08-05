"use client";

// Orquestador de la página pública /sorteo. Al montar consulta el estado del
// código (cookie httpOnly, el cliente jamás lo ve) y muestra: formulario,
// resultado (ganador / sigue participando) o una pantalla de mensaje por cada
// estado terminal. Las señales del dispositivo (fingerprint + GPS) se capturan
// en paralelo mientras el usuario completa el form y nunca bloquean el envío.
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  CalendarOff,
  CloudOff,
  Flag,
  Hourglass,
  LoaderCircle,
  QrCode,
  RotateCcw,
  ShieldAlert,
  TicketCheck,
  TicketX,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import EstadoMensaje, { type TonoMensaje } from "@/components/sorteo/EstadoMensaje";
import ResultadoGanador from "@/components/sorteo/ResultadoGanador";
import ResultadoSigue from "@/components/sorteo/ResultadoSigue";
import SorteoForm, { type DatosParticipacion } from "@/components/sorteo/SorteoForm";
import {
  capturarDispositivo,
  capturarGps,
  type CoordenadasGps,
  type DatosDispositivo,
} from "@/lib/sorteo/device";
import type {
  EstadoPublico,
  EstadoResponse,
  ParticiparResponse,
  SorteoPublico,
} from "@/lib/sorteo/publicApi";
import {
  guardarResultadoGanador,
  leerResultadoGanador,
  olvidarResultadoGanador,
} from "@/lib/sorteo/resultadoGuardado";

const MENSAJE_ERROR_ENVIO =
  "No pudimos enviar tu participación. Esperá unos segundos y tocá el botón de nuevo: tu código sigue vigente.";

/** Tope de espera del GPS en el submit: si no llegó, se participa sin él. */
const GPS_ESPERA_SUBMIT_MS = 1500;

type ClavePantalla = Exclude<EstadoPublico, "ok"> | "limite_dispositivo";

const PANTALLAS: Record<
  ClavePantalla,
  { icono: LucideIcon; titulo: string; mensaje: string; tono: TonoMensaje }
> = {
  sin_cookie: {
    icono: QrCode,
    tono: "info",
    titulo: "Escaneá el QR para participar",
    mensaje:
      "No encontramos ningún código activo en este navegador. Volvé a escanear el código QR de tu garrafa y listo.",
  },
  usado: {
    icono: TicketCheck,
    tono: "info",
    titulo: "Este código ya participó",
    mensaje:
      "Cada código juega una sola vez. Si ganaste, RioGas te contacta al teléfono que dejaste. ¡Gracias por participar!",
  },
  // El backend manda 'no_iniciado' tanto para un sorteo que todavía no arrancó
  // como para uno cancelado: el texto no puede prometer que va a empezar.
  no_iniciado: {
    icono: CalendarOff,
    tono: "info",
    titulo: "Este sorteo no está disponible",
    mensaje:
      "Por ahora no se puede participar con este código. Probá más adelante escaneando otra vez el QR de tu garrafa.",
  },
  finalizado: {
    icono: Flag,
    tono: "info",
    titulo: "El sorteo ya terminó",
    mensaje:
      "Gracias por querer participar. Estate atento a las novedades de RioGas para no perderte el próximo.",
  },
  invalido: {
    icono: TicketX,
    tono: "alerta",
    titulo: "Código no válido",
    mensaje:
      "No pudimos leer este código o no corresponde a un sorteo de RioGas. Probá escanear de nuevo el QR de tu garrafa.",
  },
  error_temporal: {
    icono: CloudOff,
    tono: "alerta",
    titulo: "No pudimos conectarnos",
    mensaje:
      "Parece un problema momentáneo de conexión. Esperá unos segundos y volvé a intentar.",
  },
  limite_dispositivo: {
    icono: Hourglass,
    tono: "info",
    // La cookie del código dura 2 h: mañana este navegador ya no la tiene, así
    // que hay que decirle que vuelva a escanear, no que "vuelva".
    titulo: "Por hoy ya está",
    mensaje:
      "Ya participaste el máximo de veces por hoy desde este dispositivo. Mañana escaneá otro QR de RioGas y seguís participando.",
  },
};

type Fase =
  | { tipo: "cargando" }
  | { tipo: "formulario"; sorteo: SorteoPublico }
  | { tipo: "mensaje"; estado: Exclude<EstadoPublico, "ok"> }
  | {
      tipo: "ganador";
      codigoCanje: string;
      telefono: string;
      sorteo: SorteoPublico;
      /** true cuando se repone desde sessionStorage tras recargar la página. */
      recuperado?: boolean;
    }
  | { tipo: "sigue"; nombre: string }
  | {
      tipo: "post";
      resultado: ClavePantalla | "edad_invalida";
      edadMinima: number;
    };

function PantallaCargando() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center px-6 py-16 text-center"
    >
      <LoaderCircle className="h-9 w-9 animate-spin text-primary" aria-hidden />
      <p className="mt-4 text-sm font-medium text-muted-foreground">
        Preparando el sorteo…
      </p>
    </div>
  );
}

export default function SorteoPublicoView() {
  const [fase, setFase] = useState<Fase>({ tipo: "cargando" });
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const dispositivoRef = useRef<Promise<DatosDispositivo> | null>(null);
  const gpsRef = useRef<Promise<CoordenadasGps | null> | null>(null);

  const cargarEstado = useCallback(async () => {
    setFase({ tipo: "cargando" });
    setErrorEnvio(null);

    let cuerpo: EstadoResponse;
    try {
      const resp = await fetch("/api/sorteo-publico/estado", {
        cache: "no-store",
      });
      cuerpo = resp.ok
        ? ((await resp.json()) as EstadoResponse)
        : { estado: "error_temporal" };
    } catch {
      cuerpo = { estado: "error_temporal" };
    }

    if (cuerpo.estado === "ok") {
      if (cuerpo.sorteo) {
        // Hay un código nuevo en juego: el premio guardado ya no aplica.
        olvidarResultadoGanador();
        setFase({ tipo: "formulario", sorteo: cuerpo.sorteo });
      } else {
        // "ok" sin sorteo = respuesta corrupta: se trata como error transitorio
        setFase({ tipo: "mensaje", estado: "error_temporal" });
      }
      return;
    }

    // El código ya se usó, pero si ganó en esta misma pestaña se le devuelve el
    // código de canje en lugar del genérico "ya participaste".
    if (cuerpo.estado === "usado") {
      const guardado = leerResultadoGanador();
      if (guardado) {
        setFase({
          tipo: "ganador",
          codigoCanje: guardado.codigoCanje,
          telefono: guardado.telefono,
          sorteo: guardado.sorteo,
          recuperado: true,
        });
        return;
      }
    }

    setFase({ tipo: "mensaje", estado: cuerpo.estado });
  }, []);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado]);

  // Captura invisible en paralelo al llenado del form (una sola vez).
  useEffect(() => {
    if (fase.tipo !== "formulario") return;
    dispositivoRef.current ??= capturarDispositivo();
    gpsRef.current ??= capturarGps();
  }, [fase.tipo]);

  const enviarParticipacion = useCallback(
    async (datos: DatosParticipacion) => {
      if (fase.tipo !== "formulario") return;
      setErrorEnvio(null);

      const dispositivo = await (dispositivoRef.current ??
        Promise.resolve({} as DatosDispositivo));
      // Si el GPS todavía no resolvió, se espera apenas y se sigue sin él.
      const gps = await Promise.race([
        gpsRef.current ?? Promise.resolve<CoordenadasGps | null>(null),
        new Promise<null>((resolver) =>
          setTimeout(() => resolver(null), GPS_ESPERA_SUBMIT_MS),
        ),
      ]);

      let respuesta: ParticiparResponse;
      try {
        const resp = await fetch("/api/sorteo-publico/participar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            nombre: datos.nombre,
            telefono: datos.telefono,
            edad: datos.edad,
            email: datos.email,
            hp: datos.hp,
            fingerprint: dispositivo.fingerprint,
            idioma: dispositivo.idioma,
            plataforma: dispositivo.plataforma,
            resolucion: dispositivo.resolucion,
            gpsLat: gps?.lat,
            gpsLng: gps?.lng,
          }),
        });
        respuesta = resp.ok
          ? ((await resp.json()) as ParticiparResponse)
          : { resultado: "error_temporal" };
      } catch {
        respuesta = { resultado: "error_temporal" };
      }

      switch (respuesta.resultado) {
        case "ganador":
          if (respuesta.codigoCanje) {
            const premio = {
              codigoCanje: respuesta.codigoCanje,
              telefono: datos.telefono,
              sorteo: fase.sorteo,
            };
            // Respaldo para que un refresh no se lleve el código de canje.
            guardarResultadoGanador(premio);
            setFase({ tipo: "ganador", ...premio });
          } else {
            // ganador sin código = respuesta corrupta: reintentable
            setErrorEnvio(MENSAJE_ERROR_ENVIO);
          }
          break;
        case "sigue":
          setFase({ tipo: "sigue", nombre: datos.nombre });
          break;
        case "error_temporal":
          // El código NO se quemó: el form queda cargado para reintentar.
          setErrorEnvio(MENSAJE_ERROR_ENVIO);
          break;
        default:
          setFase({
            tipo: "post",
            resultado: respuesta.resultado,
            edadMinima: fase.sorteo.edadMinima,
          });
      }
    },
    [fase],
  );

  let clave: string;
  let contenido: ReactNode;

  switch (fase.tipo) {
    case "cargando":
      clave = "cargando";
      contenido = <PantallaCargando />;
      break;

    case "formulario":
      clave = "formulario";
      contenido = (
        <SorteoForm
          sorteo={fase.sorteo}
          errorEnvio={errorEnvio}
          onEnviar={enviarParticipacion}
        />
      );
      break;

    case "ganador":
      clave = "ganador";
      contenido = (
        <ResultadoGanador
          codigoCanje={fase.codigoCanje}
          telefono={fase.telefono}
          sorteo={fase.sorteo}
          recuperado={fase.recuperado}
        />
      );
      break;

    case "sigue":
      clave = "sigue";
      contenido = <ResultadoSigue nombre={fase.nombre} />;
      break;

    case "mensaje": {
      clave = `mensaje-${fase.estado}`;
      // Fallback: si el backend devuelve un estado que no conocemos (o
      // basura), se muestra el mensaje de error transitorio con reintento
      // en lugar de reventar con pantalla blanca.
      const pantalla = PANTALLAS[fase.estado] ?? PANTALLAS.error_temporal;
      const conReintento = pantalla === PANTALLAS.error_temporal;
      contenido = (
        <EstadoMensaje
          icono={pantalla.icono}
          titulo={pantalla.titulo}
          mensaje={pantalla.mensaje}
          tono={pantalla.tono}
          accion={
            conReintento ? (
              <Button
                type="button"
                onClick={() => void cargarEstado()}
                className="h-12 w-full rounded-xl text-base font-semibold"
              >
                <RotateCcw className="size-5" aria-hidden />
                Probar de nuevo
              </Button>
            ) : undefined
          }
        />
      );
      break;
    }

    case "post": {
      clave = `post-${fase.resultado}`;
      if (fase.resultado === "edad_invalida") {
        contenido = (
          <EstadoMensaje
            icono={ShieldAlert}
            tono="alerta"
            titulo="Falta un poquito"
            mensaje={`Para participar tenés que tener al menos ${fase.edadMinima} años. ¡Te esperamos en el próximo sorteo!`}
          />
        );
      } else {
        // Mismo fallback que en "mensaje": resultado desconocido → mensaje
        // de error transitorio en lugar de TypeError.
        const pantalla = PANTALLAS[fase.resultado] ?? PANTALLAS.error_temporal;
        contenido = (
          <EstadoMensaje
            icono={pantalla.icono}
            titulo={pantalla.titulo}
            mensaje={pantalla.mensaje}
            tono={pantalla.tono}
          />
        );
      }
      break;
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <section aria-live="polite" className="w-full max-w-md">
        <div className="overflow-hidden rounded-3xl bg-card shadow-[0_28px_70px_-18px_rgba(3,15,38,0.55)] ring-1 ring-white/25">
          <div
            aria-hidden
            className="h-1.5 bg-gradient-to-r from-primary via-[#2E6BD0] to-accent"
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={clave}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            >
              {contenido}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </MotionConfig>
  );
}
