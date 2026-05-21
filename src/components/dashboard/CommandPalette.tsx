"use client";

import { Command } from "cmdk";
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  MapPin,
  Wrench,
  Settings,
  UserCog,
  Map,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Search,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/useTheme";
import { clearAuthToken } from "@/lib/authToken";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Panel principal", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "inicio"] },
  { label: "Pedidos", href: "/dashboard/pedidos", icon: Package, keywords: ["orders"] },
  { label: "Móviles", href: "/dashboard/moviles", icon: Truck, keywords: ["vehiculos"] },
  { label: "Clientes", href: "/dashboard/clientes", icon: Users, keywords: ["customers"] },
  { label: "Mapa", href: "/dashboard/mapa", icon: Map, keywords: ["map"] },
  { label: "Services", href: "/dashboard/services", icon: Wrench, keywords: ["servicios"] },
  { label: "Normalizar calles", href: "/dashboard/normalizar-calles", icon: MapPin, keywords: ["streets", "normalize"] },
  { label: "Usuarios", href: "/dashboard/usuarios", icon: UserCog, keywords: ["users", "admin"] },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings, keywords: ["settings", "config"] },
];

const RECENT_KEY = "goya:recent-pages";
const MAX_RECENT = 5;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>([]);
  const { setMode } = useTheme();

  // Load recent pages from localStorage when palette opens
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecent(arr.slice(0, MAX_RECENT));
      }
    } catch {}
  }, [open]);

  const go = useCallback(
    (href: string) => {
      // Push to recent (deduped)
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        const arr: string[] = raw ? JSON.parse(raw) : [];
        const next = [href, ...arr.filter((x) => x !== href)].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange],
  );

  const handleLogout = useCallback(() => {
    onOpenChange(false);
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
  }, [router, onOpenChange]);

  // Esc to close — cmdk wires it but we wire it on the overlay too
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  const recentItems = recent
    .map((href) => NAV_ITEMS.find((it) => it.href === href))
    .filter((x): x is NavItem => Boolean(x));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-fade-in-up"
      onClick={() => onOpenChange(false)}
    >
      <Command
        label="Búsqueda global"
        className="surface-glass w-full max-w-xl mx-4 rounded-[var(--radius-xl)] shadow-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Buscar páginas, comandos, acciones…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-0"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono shrink-0">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados.
          </Command.Empty>

          {recentItems.length > 0 && (
            <Command.Group
              heading="Recientes"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {recentItems.map((it) => (
                <Command.Item
                  key={"recent-" + it.href}
                  value={it.label + " " + it.href}
                  onSelect={() => go(it.href)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
                >
                  <it.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{it.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 data-[selected=true]:opacity-100" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading="Navegación"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {NAV_ITEMS.map((it) => (
              <Command.Item
                key={it.href}
                value={it.label + " " + (it.keywords?.join(" ") ?? "") + " " + it.href}
                onSelect={() => go(it.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
              >
                <it.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{it.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 data-[selected=true]:opacity-100" />
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            heading="Acciones"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            <Command.Item
              value="tema claro light"
              onSelect={() => {
                setMode("light");
                onOpenChange(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
            >
              <Sun className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Tema claro</span>
            </Command.Item>
            <Command.Item
              value="tema oscuro dark"
              onSelect={() => {
                setMode("dark");
                onOpenChange(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
            >
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Tema oscuro</span>
            </Command.Item>
            <Command.Item
              value="tema sistema system auto"
              onSelect={() => {
                setMode("system");
                onOpenChange(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
            >
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Tema del sistema</span>
            </Command.Item>
            <Command.Item
              value="cerrar sesion logout salir"
              onSelect={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-destructive cursor-pointer data-[selected=true]:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="flex-1">Cerrar sesión</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

/**
 * Global keyboard handler — wires Cmd/Ctrl+K to open the palette.
 * Mount once at the dashboard root.
 */
export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}
