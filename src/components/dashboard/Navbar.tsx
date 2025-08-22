"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Info } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import { useState, useEffect, useMemo } from "react";
import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/authToken";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"; // <-- shadcn/ui dialog

/* ===== Props que llegan desde NavbarServer (Server Component) ===== */
type NavbarProps = {
  routeName?: string;
  routeCode?: string;     // XXXX-XXXX (solo hash)
  codeWithApp?: string;   // ej: 3|XXXX-XXXX
  userNameFromServer?: string;
  dateTime?: string;      // fecha/hora fija (render server)
};
/* ================================================================= */

const user =
  typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("user") || "{}")
    : {};

function getPuestosFromStorage() {
  if (typeof window === "undefined") return [];
  const puestosStr = localStorage.getItem("puestos");
  if (puestosStr) {
    try { return JSON.parse(puestosStr); } catch { return []; }
  }
  const puestoStr = localStorage.getItem("puesto");
  if (puestoStr) {
    try {
      const p = JSON.parse(puestoStr);
      return p && p.puestoId ? [p] : [];
    } catch { return []; }
  }
  return [];
}

export function Navbar({
  routeName = "",
  routeCode = "",
  codeWithApp = "",
  userNameFromServer = "",
  dateTime = "",
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [puestos, setPuestos] = useState<any[]>([]);
  const [puestoActual, setPuestoActual] = useState<any>(null);
  const [openInfo, setOpenInfo] = useState(false);
  const router = useRouter();

  // Usuario efectivo: prioriza lo que viene del middleware (server)
  const effectiveUserName = userNameFromServer || user.name || "";
  const userInitials = effectiveUserName
    ? effectiveUserName.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()
    : "JD";

  useEffect(() => {
    setMounted(true);
    const ps = getPuestosFromStorage();
    setPuestos(ps);
    if (ps.length > 0) {
      const actual = localStorage.getItem("puestoActual");
      if (actual) {
        try { setPuestoActual(JSON.parse(actual)); }
        catch { setPuestoActual(ps[0]); }
      } else {
        setPuestoActual(ps[0]);
      }
    }
  }, []);

  // Cuando cambia el puesto seleccionado
  const handleChangePuesto = (value: string) => {
    const nuevo = puestos.find((p) => String(p.puestoId) === value);
    if (nuevo) {
      setPuestoActual(nuevo);
      localStorage.setItem("puestoActual", JSON.stringify(nuevo));
      document.cookie = `puestoId=${nuevo.puestoId}; path=/; max-age=${60 * 60 * 24 * 30}`;
      document.cookie = `PuestoDsc=${nuevo.PuestoDsc}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }
  };

  const handleLogout = () => {
    try {
      clearAuthToken();
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("puesto");
        localStorage.removeItem("puestos");
        localStorage.removeItem("puestoActual");
      }
      document.cookie = "puestoId=; path=/; max-age=0";
      document.cookie = "PuestoDsc=; path=/; max-age=0";
    } finally {
      router.push("/login");
    }
  };

  // Texto listo para copiar desde el modal
  const detallesParaCopiar = useMemo(() => {
    return [
      `Pantalla: ${routeName || "(desconocido)"}`,
      `Código: ${codeWithApp || routeCode || "(desconocido)"}`,
      `Usuario: ${effectiveUserName || "(desconocido)"}`,
      `Fecha/Hora: ${dateTime || "(desconocido)"}`,
      `Puesto: ${puestoActual?.PuestoDsc ?? "(sin puesto)"}`
    ].join("\n");
  }, [routeName, codeWithApp, routeCode, effectiveUserName, dateTime, puestoActual]);

  const copiarDetalles = async () => {
    try {
      await navigator.clipboard.writeText(detallesParaCopiar);
    } catch {
      // Fallback: descarga .txt si falla clipboard (navegadores raros)
      const blob = new Blob([detallesParaCopiar], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "detalles_pantalla.txt"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b bg-card gap-4">
      {/* IZQUIERDA: info de la pantalla actual (del middleware vía NavbarServer) */}
      <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground">
        {routeName && (
          <span className="px-2 py-1 rounded border bg-secondary/40">
            Pantalla: <span className="font-medium text-foreground">{routeName}</span>
          </span>
        )}
        {codeWithApp && (
          <span className="px-2 py-1 rounded border bg-secondary/40">
            Código: <code className="font-mono">{codeWithApp}</code>
          </span>
        )}
        {dateTime && (
          <span className="px-2 py-1 rounded border bg-secondary/40">
            {dateTime}
          </span>
        )}
      </div>

      {/* DERECHA: acciones, info de permisos (modal), puestos y usuario */}
      <div className="flex items-center gap-4">
        {/* Botón de info/permiso + combo de puestos */}
        <div className="flex items-center gap-2">
          {/* Ícono a la IZQUIERDA del combo Puestos */}
          <Dialog open={openInfo} onOpenChange={setOpenInfo}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="Información de esta pantalla">
                <Info className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Información de esta pantalla</DialogTitle>
                <DialogDescription>
                  Datos útiles para soporte / permisos.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Pantalla</span>
                  <span className="font-medium">{routeName || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Código</span>
                  <code className="font-mono">{codeWithApp || routeCode || "—"}</code>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Usuario</span>
                  <span className="font-medium">{effectiveUserName || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Fecha/Hora</span>
                  <span className="font-medium">{dateTime || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Puesto</span>
                  <span className="font-medium">
                    {puestoActual?.PuestoDsc ?? (mounted && puestos.length === 1 ? puestos[0].PuestoDsc : "—")}
                  </span>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={copiarDetalles}>
                  Copiar detalles
                </Button>
                <Button onClick={() => setOpenInfo(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Combo de puestos */}
          {mounted && puestos.length > 1 && (
            <Select
              value={puestoActual?.puestoId?.toString() || ""}
              onValueChange={handleChangePuesto}
            >
              <SelectTrigger className="w-[180px]">
                Puesto: {puestoActual?.PuestoDsc || "-"}
              </SelectTrigger>
              <SelectContent>
                {puestos.map((p) => (
                  <SelectItem key={p.puestoId} value={String(p.puestoId)}>
                    {p.PuestoDsc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {mounted && puestos.length === 1 && (
            <div className="text-sm text-muted-foreground px-3 py-1 border rounded bg-secondary">
              Puesto: {puestos[0].PuestoDsc}
            </div>
          )}
        </div>

        {/* Avatar / Menú */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-full p-0 h-10 w-10">
              <Avatar>
                <AvatarImage src="/avatar.png" alt="Avatar" />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{effectiveUserName || "Mi cuenta"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <DropdownMenuItem>Configuración</DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {mounted && (theme === "dark" ? (
                <>
                  <Sun className="mr-2 h-4 w-4" /> Tema Claro
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4" /> Tema Oscuro
                </>
              ))}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
