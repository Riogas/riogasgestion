// src/app/no-autorizado/page.tsx
import { LockKeyhole, TimerOff } from "lucide-react";
import Image from "next/image";
import { headers, cookies } from "next/headers";
import CopyClipboard from "./CopyClipboard";
import CurrentDateTime from "./CurrentDateTime";
import SolicitarAccesoButton from "./SolicitarAccesoButton";
import { verificarSesionSecapi } from "@/lib/secapiSesion";
import { RUTA_LOGIN_SESION_EXPIRADA } from "@/lib/sesion";

type Search = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<Search> };

export default async function NoAutorizado({ searchParams }: PageProps) {
  const sp = await searchParams; // 👈 Next 15: hay que await
  const code   = (sp.code as string)   || "";
  const ruta   = (sp.ruta as string)   || "";
  const nombre = (sp.nombre as string) || "";

  const appId = process.env.NEXT_PUBLIC_APLICACION_ID || "3";
  const codeWithApp = `${appId}|${code}`;

  const h = await headers();
  const c = await cookies();

  // El middleware setea x-user-name, pero NO se pasa en el redirect a /no-autorizado
  // (ruta pública). Fallback: decodificar el JWT de la cookie `token` (campo username).
  function userFromToken(tok?: string): string | null {
    if (!tok) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(
          tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8"),
      );
      return payload?.username || payload?.userName || payload?.name || null;
    } catch {
      return null;
    }
  }
  const userName =
    h.get("x-user-name") ??
    c.get("userName")?.value ??
    userFromToken(c.get("token")?.value) ??
    "—";

  // ¿Está acá por falta de permiso o porque su sesión murió? Se le pregunta a
  // secapi: el `exp` del token no alcanza para saberlo, porque un token puede
  // estar dentro de su plazo y aun así ser rechazado (firmado con otro secreto).
  // Sin esto la pantalla ofrece "Solicitar acceso", que viaja con ese mismo
  // token y por lo tanto también falla: el usuario queda encerrado.
  // DESCONOCIDO (secapi no contestó) mantiene la pantalla de siempre: no vamos
  // a echar a nadie por un timeout.
  const estadoSesion = await verificarSesionSecapi(c.get("token")?.value);

  if (estadoSesion === "VENCIDA") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="surface-glass rounded-2xl shadow-lg p-10 max-w-lg w-full flex flex-col items-center animate-scale-in">
          <TimerOff size={60} className="text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Tu sesión venció</h1>
          <p className="text-muted-foreground mb-6 text-center">
            No es un problema de permisos: la sesión caducó y hay que volver a
            iniciarla.
            {ruta ? (
              <>
                <br />
                Después de entrar vas a poder seguir en{" "}
                <code className="rounded bg-background border border-border px-1.5 py-0.5">
                  {ruta}
                </code>
                .
              </>
            ) : null}
          </p>
          <a
            href={RUTA_LOGIN_SESION_EXPIRADA}
            className="w-full px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-center"
          >
            Volver a entrar
          </a>
        </div>
      </div>
    );
  }

  if (estadoSesion === "NO_CONFIGURADO") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="surface-glass rounded-2xl shadow-lg p-10 max-w-lg w-full flex flex-col items-center animate-scale-in">
          <LockKeyhole size={60} className="text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Servicio de seguridad no disponible
          </h1>
          <p className="text-muted-foreground mb-6 text-center">
            SecuritySuite no puede validar sesiones porque le falta su secreto de
            firma. No es tu usuario ni tus permisos, y volver a iniciar sesión no
            lo soluciona: avisá a Sistemas con el código{" "}
            <code className="rounded bg-background border border-border px-1.5 py-0.5">
              SECRETO_NO_CONFIGURADO
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="surface-glass rounded-2xl shadow-lg p-10 max-w-lg w-full flex flex-col items-center animate-scale-in">
        <LockKeyhole size={60} className="text-primary mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">Acceso denegado</h1>
        <p className="text-muted-foreground mb-6 text-center">
          No tienes permisos para acceder a esta sección.<br />
          Si crees que esto es un error, contacta al administrador.
        </p>

        <Image
          src="/no-access-dark.png"
          width={160}
          height={160}
          alt="No autorizado"
          className="mb-6 rounded-lg shadow-sm"
        />

        {(code || ruta || nombre) && (
          <div className="w-full mb-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-foreground">Detalles de esta pantalla</div>
              <CopyClipboard
                textToCopy={`Pantalla: ${nombre || ruta}\nRuta: ${ruta}\nCódigo: ${codeWithApp}\nUsuario: ${userName}`}
                label="Copiar"
              />
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">Pantalla:</span>{" "}
                <span className="font-medium text-foreground">{nombre || ruta || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ruta:</span>{" "}
                <code className="rounded bg-background border border-border px-1.5 py-0.5">{ruta || "—"}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Código:</span>{" "}
                <code className="rounded bg-background border border-border px-1.5 py-0.5">{codeWithApp || "—"}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Usuario:</span>{" "}
                <span className="font-medium text-foreground">{userName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Fecha y hora:</span>
                <CurrentDateTime />
              </div>
            </div>
          </div>
        )}

        <div className="flex w-full gap-3">
          <a href="/dashboard" className="flex-1 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-center">
            Volver al dashboard
          </a>
          <SolicitarAccesoButton code={code} ruta={ruta} nombre={nombre} />
        </div>
      </div>
    </div>
  );
}
