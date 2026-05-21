"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Info, Monitor, Hash, User2, CalendarClock, MapPin, Clipboard, ClipboardCheck,
  Bell, CheckCircle2, AlertTriangle, Search, Command as CommandIcon, LogOut,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Image from "next/image";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPalette, useCommandPaletteHotkey } from "./CommandPalette";

/* ===== Props que llegan desde NavbarServer (Server Component) ===== */
type NavbarProps = {
  routeName?: string;
  routeCode?: string;
  codeWithApp?: string;
  userNameFromServer?: string;
  dateTime?: string;
};

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

function getUserFromStorage() {
  if (typeof window === "undefined") return {};
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : {};
  } catch {
    return {};
  }
}

export function Navbar({
  routeName = "",
  routeCode = "",
  codeWithApp = "",
  userNameFromServer = "",
  dateTime = "",
}: NavbarProps) {
  const { mounted: themeMounted } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [puestos, setPuestos] = useState<any[]>([]);
  const [puestoActual, setPuestoActual] = useState<any>(null);
  const [openInfo, setOpenInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  // Cmd+K to open command palette
  useCommandPaletteHotkey(() => setPaletteOpen(true));

  // Usuario efectivo: prioriza localStorage que tiene el nombre completo
  const effectiveUserName = user.nombre || user.name || userNameFromServer || "";

  const userInitials = effectiveUserName
    ? effectiveUserName
        .trim()
        .split(/\s+/)
        .filter((p: string) => p.length > 0)
        .map((p: string) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "JD";

  useEffect(() => {
    setMounted(true);
    const userFromStorage = getUserFromStorage();
    setUser(userFromStorage);

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
  }, [userNameFromServer]);

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

  // Notificaciones (mock)
  type Notification = { id: string; title: string; description?: string; date: string; type?: "info" | "warning" | "success"; read?: boolean };
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "1", title: "Pedido #1042 asignado", description: "Móvil M-103 fue asignado", date: new Date().toISOString(), type: "success", read: false },
    { id: "2", title: "Demora en zona Z2", description: "Aumentó la demora estimada a 15m", date: new Date().toISOString(), type: "warning", read: false },
    { id: "3", title: "Nueva campaña activa", description: "Promo Primavera disponible", date: new Date().toISOString(), type: "info", read: true },
  ]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const markAllRead = () => setNotifications((ns) => ns.map(n => ({ ...n, read: true })));
  const toggleNotifOpen = (open: boolean) => {
    setNotifOpen(open);
    if (open) markAllRead();
  };

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
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const blob = new Blob([detallesParaCopiar], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "detalles_pantalla.txt"; a.click();
      URL.revokeObjectURL(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 h-16 px-6 flex items-center justify-between surface-glass-strong gap-4 animate-fade-in-down">
        {/* IZQUIERDA: logo */}
        <div className="flex items-center gap-3">
          <Image src="/logogoya.png" alt="Logo" width={120} height={32} className="h-8 w-auto transition-transform duration-200 hover:scale-105" />
        </div>

        {/* CENTRO: command palette trigger (Cmd+K) */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={
            "hidden md:inline-flex items-center gap-2 h-9 px-3 max-w-md flex-1 mx-4 " +
            "rounded-[var(--radius-md)] border border-border bg-card/60 text-sm text-muted-foreground " +
            "hover:bg-card hover:border-input transition-colors duration-150 " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          }
          aria-label="Búsqueda global"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">Buscar páginas, acciones…</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono shrink-0">
            <CommandIcon className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Mobile: icon-only Cmd+K trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          onClick={() => setPaletteOpen(true)}
          aria-label="Búsqueda"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* DERECHA: acciones, info, puestos, tema, usuario */}
        <div className="flex items-center gap-2">
          {/* Notificaciones */}
          <Popover open={notifOpen} onOpenChange={toggleNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificaciones">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold flex items-center justify-center shadow-sm animate-scale-in">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
              <div className="border-b border-border px-3 py-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Notificaciones</div>
                <div className="text-[11px] text-muted-foreground">{unreadCount === 0 ? "Sin nuevas" : `${unreadCount} nuevas`}</div>
              </div>
              <div className="max-h-80 overflow-auto divide-y divide-border/60">
                {notifications.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No hay notificaciones</div>
                )}
                {notifications.map((n, i) => {
                  const tonal =
                    n.type === "warning" ? "bg-warn/10 text-warn"
                    : n.type === "success" ? "bg-success/10 text-success"
                    : "bg-primary/10 text-primary";
                  return (
                    <button
                      key={n.id}
                      className={`w-full text-left p-3 hover:bg-muted/40 transition-colors duration-150 animate-fade-in-up ${n.read ? "opacity-70" : ""}`}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${tonal}`}>
                          {n.type === "warning" ? <AlertTriangle className="h-4 w-4" />
                            : n.type === "success" ? <CheckCircle2 className="h-4 w-4" />
                            : <Info className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
                          {n.description && <div className="text-xs text-muted-foreground truncate">{n.description}</div>}
                          <div className="text-[11px] text-muted-foreground mt-1">{new Date(n.date).toLocaleString()}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Info de pantalla */}
          <Dialog open={openInfo} onOpenChange={setOpenInfo}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Información de esta pantalla">
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

              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-border bg-muted/30 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary shrink-0">
                        <Monitor className="h-4 w-4" />
                      </span>
                      <div className="text-sm min-w-0">
                        <div className="text-muted-foreground text-xs">Pantalla</div>
                        <div className="font-medium text-foreground truncate">{routeName || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary shrink-0">
                        <Hash className="h-4 w-4" />
                      </span>
                      <div className="text-sm min-w-0">
                        <div className="text-muted-foreground text-xs">Código</div>
                        <code className="font-mono text-xs text-foreground">{codeWithApp || routeCode || "—"}</code>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary shrink-0">
                        <User2 className="h-4 w-4" />
                      </span>
                      <div className="text-sm min-w-0">
                        <div className="text-muted-foreground text-xs">Usuario</div>
                        <div className="font-medium text-foreground truncate">{effectiveUserName || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary shrink-0">
                        <CalendarClock className="h-4 w-4" />
                      </span>
                      <div className="text-sm min-w-0">
                        <div className="text-muted-foreground text-xs">Fecha/Hora</div>
                        <div className="font-medium text-foreground truncate">{dateTime || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:col-span-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary shrink-0">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="text-sm min-w-0">
                        <div className="text-muted-foreground text-xs">Puesto</div>
                        <div className="font-medium text-foreground truncate">{puestoActual?.PuestoDsc ?? (mounted && puestos.length === 1 ? puestos[0].PuestoDsc : "—")}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={copiarDetalles}>
                  {copied ? (
                    <>
                      <ClipboardCheck className="h-4 w-4 mr-1" /> Copiado
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-4 w-4 mr-1" /> Copiar
                    </>
                  )}
                </Button>
                <Button onClick={() => setOpenInfo(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Combo de puestos — preservado tal cual */}
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
            <div className="hidden lg:inline-flex text-xs text-muted-foreground px-2.5 py-1 border border-border rounded-[var(--radius-md)]">
              Puesto: <span className="ml-1 text-foreground font-medium">{puestos[0].PuestoDsc}</span>
            </div>
          )}

          {/* Theme toggle 3-state */}
          <ThemeToggle />

          {/* Avatar / Menú */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-full p-0 h-9 w-9 transition-transform duration-150 hover:scale-105" aria-label="Menú de usuario">
                <Avatar size="default" className="ring-2 ring-transparent transition-all duration-150 hover:ring-primary/30">
                  <AvatarImage src="/avatar.png" alt={effectiveUserName} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium leading-none text-foreground">{effectiveUserName || "Usuario"}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    {user.email || user.username || ""}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Configuración</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Command palette (Cmd+K) */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
