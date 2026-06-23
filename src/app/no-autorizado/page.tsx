// src/app/no-autorizado/page.tsx
import { LockKeyhole } from "lucide-react";
import Image from "next/image";
import { headers, cookies } from "next/headers";
import CopyClipboard from "./CopyClipboard";
import CurrentDateTime from "./CurrentDateTime";
import SolicitarAccesoButton from "./SolicitarAccesoButton";

type Search = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<Search> };

export default async function NoAutorizado({ searchParams }: PageProps) {
  const sp = await searchParams; // 👈 Next 15: hay que await
  const code   = (sp.code as string)   || "";
  const ruta   = (sp.ruta as string)   || "";
  const nombre = (sp.nombre as string) || "";

  const appId = process.env.NEXT_PUBLIC_APLICACION_ID || "0";
  const codeWithApp = `${appId}|${code}`;

  const h = await headers();
  const c = await cookies();
  const userName = h.get("x-user-name") ?? c.get("userName")?.value ?? "—";

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
          <a href="/" className="flex-1 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-center">
            Volver al inicio
          </a>
          <SolicitarAccesoButton code={code} ruta={ruta} nombre={nombre} />
        </div>
      </div>
    </div>
  );
}
