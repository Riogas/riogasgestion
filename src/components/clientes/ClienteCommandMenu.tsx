"use client";

/**
 * ClienteCommandMenu — Paleta de comandos contextual al cliente abierto.
 *
 * Atajo: ⌘J / Ctrl+J (se eligió ⌘J porque ⌘K ya lo usa el CommandPalette global
 * en src/components/dashboard/CommandPalette.tsx via useCommandPaletteHotkey).
 * El listener solo vive mientras la ficha está montada, así que no hay colisión
 * posible entre ambas paletas.
 */

import { Command } from "cmdk";
import {
  Search,
  User,
  MapPin,
  Phone,
  Package,
  Wrench,
  Receipt,
  PhoneCall,
  MessageCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useQueryState } from "nuqs";
import { type Cliente } from "@/lib/types/cliente";

const TABS = ["datos", "direcciones", "telefonos", "pedidos", "servicios", "cuenta"] as const;
type TabValue = (typeof TABS)[number];

interface ClienteCommandMenuProps {
  cliente: Cliente;
}

/** Nombre del evento DOM personalizado para abrir la paleta desde fuera del componente. */
export const CLIENTE_COMMAND_MENU_EVENT = "cliente:open-command-menu";

/** Dispara el evento que abre ClienteCommandMenu (usar en botones externos). */
export function openClienteCommandMenu() {
  window.dispatchEvent(new CustomEvent(CLIENTE_COMMAND_MENU_EVENT));
}

export function ClienteCommandMenu({ cliente }: ClienteCommandMenuProps) {
  const [open, setOpen] = useState(false);

  const [, setTab] = useQueryState<TabValue>("tab", {
    defaultValue: "datos",
    parse: (v): TabValue => (TABS.includes(v as TabValue) ? (v as TabValue) : "datos"),
    serialize: (v) => v,
    shallow: true,
  });

  const doOpen = useCallback(() => setOpen(true), []);

  // Keyboard shortcut: ⌘J / Ctrl+J
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        doOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doOpen]);

  // Custom DOM event — dispatched by the button in ClienteHeader
  useEffect(() => {
    window.addEventListener(CLIENTE_COMMAND_MENU_EVENT, doOpen);
    return () => window.removeEventListener(CLIENTE_COMMAND_MENU_EVENT, doOpen);
  }, [doOpen]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const goTab = useCallback(
    (tab: TabValue) => {
      setTab(tab);
      setOpen(false);
    },
    [setTab],
  );

  if (!open) return null;

  // Teléfono principal
  const telPrincipal =
    cliente.telefonos.find((t) => t.principal) ?? cliente.telefonos[0] ?? null;

  const nombreCompleto = cliente.nombre ?? "—";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm animate-fade-in-up"
      onClick={() => setOpen(false)}
    >
      <Command
        label={`Comandos — ${nombreCompleto}`}
        className="surface-glass w-full max-w-xl mx-4 rounded-[var(--radius-xl)] shadow-lg overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Command.Input
            autoFocus
            placeholder={`Comandos del cliente ${nombreCompleto}…`}
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

          {/* ── Navegación de tabs ── */}
          <Command.Group
            heading="Ir a tab"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {[
              { tab: "datos" as const, label: "Datos del cliente", icon: User },
              { tab: "direcciones" as const, label: "Direcciones", icon: MapPin },
              { tab: "telefonos" as const, label: "Teléfonos", icon: Phone },
              { tab: "pedidos" as const, label: "Pedidos", icon: Package },
              { tab: "servicios" as const, label: "Servicios", icon: Wrench },
              { tab: "cuenta" as const, label: "Cuenta y saldos", icon: Receipt },
            ].map(({ tab, label, icon: Icon }) => (
              <Command.Item
                key={tab}
                value={`ir a ${label} ${tab}`}
                onSelect={() => goTab(tab)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
              </Command.Item>
            ))}
          </Command.Group>

          {/* ── Acciones rápidas ── */}
          <Command.Group
            heading="Acciones"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {/* Agregar teléfono */}
            <Command.Item
              value="agregar telefono nuevo"
              onSelect={() => goTab("telefonos")}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Agregar teléfono</span>
            </Command.Item>

            {/* Agregar dirección */}
            <Command.Item
              value="agregar direccion nueva"
              onSelect={() => goTab("direcciones")}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Agregar dirección</span>
            </Command.Item>

            {/* Llamar al principal */}
            {telPrincipal && (
              <Command.Item
                value={`llamar telefono principal ${telPrincipal.numero}`}
                onSelect={() => {
                  setOpen(false);
                  window.location.href = `tel:${telPrincipal.numero}`;
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
              >
                <PhoneCall className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  Llamar al principal{" "}
                  <span className="text-muted-foreground font-mono text-xs">
                    {telPrincipal.numero}
                  </span>
                </span>
              </Command.Item>
            )}

            {/* WhatsApp */}
            {telPrincipal && (
              <Command.Item
                value={`whatsapp wa ${telPrincipal.numero}`}
                onSelect={() => {
                  setOpen(false);
                  // Normalizar el número: quitar espacios/guiones, prefijo UY si hace falta
                  const raw = telPrincipal.numero.replace(/[\s\-()]/g, "");
                  window.open(`https://wa.me/${raw}`, "_blank", "noopener,noreferrer");
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted"
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  WhatsApp{" "}
                  <span className="text-muted-foreground font-mono text-xs">
                    {telPrincipal.numero}
                  </span>
                </span>
              </Command.Item>
            )}

            {/* Registrar pedido — deshabilitado (próximamente) */}
            <Command.Item
              value="registrar pedido nuevo orden"
              disabled
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm text-muted-foreground cursor-not-allowed opacity-50"
            >
              <Package className="h-4 w-4" />
              <span className="flex-1">Registrar pedido</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                Próximamente
              </span>
            </Command.Item>
          </Command.Group>
        </Command.List>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-border/60 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>
            <kbd className="font-mono bg-muted px-1 py-0.5 rounded">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="font-mono bg-muted px-1 py-0.5 rounded">↵</kbd> seleccionar
          </span>
          <span>
            <kbd className="font-mono bg-muted px-1 py-0.5 rounded">ESC</kbd> cerrar
          </span>
          <span className="ml-auto">
            Abre con{" "}
            <kbd className="font-mono bg-muted px-1 py-0.5 rounded">⌘J</kbd>
          </span>
        </div>
      </Command>
    </div>
  );
}
