"use client";

import { useQueryState } from "nuqs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Cliente } from "@/lib/types/cliente";
import { DatosTab } from "./tabs/DatosTab";
import { TelefonosTab } from "./tabs/TelefonosTab";
import { DireccionesTab } from "./tabs/DireccionesTab";
import { EmptyState } from "@/components/ui/EmptyState";
import { Package, Wrench, Receipt } from "lucide-react";

const TABS = ["datos", "direcciones", "telefonos", "pedidos", "servicios", "cuenta"] as const;
type TabValue = (typeof TABS)[number];

interface ClienteTabsProps {
  cliente: Cliente;
}

function TabContent({ tab, cliente }: { tab: TabValue; cliente: Cliente }) {
  switch (tab) {
    case "datos":
      return <DatosTab cliente={cliente} />;
    case "direcciones":
      return <DireccionesTab cliente={cliente} />;
    case "telefonos":
      return <TelefonosTab cliente={cliente} />;
    case "pedidos":
      return (
        <EmptyState
          icon={Package}
          title="Pedidos — próximamente"
          description="El módulo de pedidos se integrará en la Fase 5."
          size="default"
        />
      );
    case "servicios":
      return (
        <EmptyState
          icon={Wrench}
          title="Servicios — próximamente"
          description="El módulo de servicios se integrará en la Fase 5."
          size="default"
        />
      );
    case "cuenta":
      return (
        <EmptyState
          icon={Receipt}
          title="Cuenta — próximamente"
          description="El módulo de cuenta y saldos se integrará en la Fase 5."
          size="default"
        />
      );
  }
}

export function ClienteTabs({ cliente }: ClienteTabsProps) {
  const shouldReduceMotion = useReducedMotion();

  const [tab, setTab] = useQueryState<TabValue>("tab", {
    defaultValue: "datos",
    parse: (v): TabValue => (TABS.includes(v as TabValue) ? (v as TabValue) : "datos"),
    serialize: (v) => v,
    shallow: true,
  });

  const variants = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
        exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
      };

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabValue)}
      className="flex flex-col flex-1 min-h-0 gap-0"
    >
      <TabsList className="shrink-0 overflow-x-auto">
        <TabsTrigger value="datos">Datos</TabsTrigger>
        <TabsTrigger value="direcciones">
          Direcciones
          <CountBadge count={cliente.direcciones.length} />
        </TabsTrigger>
        <TabsTrigger value="telefonos">
          Teléfonos
          <CountBadge count={cliente.telefonos.length} />
        </TabsTrigger>
        <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        <TabsTrigger value="servicios">Servicios</TabsTrigger>
        <TabsTrigger value="cuenta">Cuenta</TabsTrigger>
      </TabsList>

      <div className="relative flex-1 min-h-0 overflow-auto pt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} {...variants} className="h-full">
            <TabContent tab={tab} cliente={cliente} />
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}
