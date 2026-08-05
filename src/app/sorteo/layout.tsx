// Layout standalone de la campaña pública de sorteos: SIN chrome del
// dashboard (sin Sidebar/Navbar ni providers de auth — esos viven en
// /dashboard). Hereda del root layout solo la fuente Geist y los providers
// globales inofensivos. Tema claro fijo vía `.sorteo-light` (sorteo.css).
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import "./sorteo.css";

export const metadata: Metadata = {
  title: "Sorteo RioGas",
  description:
    "Escaneaste el QR de tu garrafa: completá tus datos y participá del sorteo de RioGas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#123C78",
};

export default function SorteoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="sorteo-light relative flex min-h-dvh flex-col overflow-x-hidden text-foreground">
      {/* Fondo de marca: foto + scrim azul profundo + calor naranja subiendo
          desde la base (la llama de la hornalla, en clave de campaña). */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/backgroundgoya.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#081D3F]/95 via-[#123C78]/90 to-[#17498F]/85" />
        <div className="absolute inset-x-0 bottom-0 h-[45vh] bg-[radial-gradient(ellipse_at_bottom,rgba(255,122,26,0.30),transparent_65%)]" />
      </div>

      <header className="flex justify-center px-6 pb-3 pt-[max(2.25rem,env(safe-area-inset-top))]">
        <div className="relative">
          {/* halo suave para despegar el logo del scrim azul */}
          <div
            aria-hidden
            className="absolute inset-0 -m-6 rounded-full bg-white/10 blur-2xl"
          />
          <Image
            src="/logogoya.png"
            alt="RioGas"
            width={240}
            height={130}
            priority
            className="relative h-auto w-40 drop-shadow-[0_4px_18px_rgba(2,10,30,0.55)] sm:w-48"
          />
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center px-4 pb-8 pt-3">
        {children}
      </main>

      <footer className="pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs font-medium tracking-wide text-white/60">
        © {new Date().getFullYear()} RioGas · Uruguay
      </footer>
    </div>
  );
}
