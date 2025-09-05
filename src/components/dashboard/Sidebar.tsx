"use client";

import { Button } from "@/components/ui/button";
import { Menu, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  apiGetMenuByRole,
  Role,
  MenuItem as ApiMenuItem,
} from "@/services/api";
import { iconMap } from "./iconMap";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLoading } from "@/lib/LoadingContext";

interface Props {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

// Aseguramos que los iconos coincidan con los del mapa
interface MenuItem extends ApiMenuItem {
  icon: keyof typeof iconMap;
  children?: MenuItem[];
}

export function Sidebar({ collapsed, setCollapsed }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading: setGlobalLoading } = useLoading();

  const debug = (...args: any[]) => console.log("[Sidebar]", ...args);
  const warn = (...args: any[]) => console.warn("[Sidebar]", ...args);
  const error = (...args: any[]) => console.error("[Sidebar]", ...args);

  // Estado abierto móvil: aprovechamos collapsed como trigger (cuando no está colapsado se muestra)
  const isMobileOpen = useMemo(() => !collapsed, [collapsed]);

  const isExpanded = (id: string) => expanded.includes(id);
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  useEffect(() => {
    debug("mounted. collapsed=", collapsed, "pathname=", pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    debug("storedUser=", storedUser);
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as { role: Role };
        const role: Role = (user?.role as Role) || "user";
        debug("calling apiGetMenuByRole with role=", role);
        apiGetMenuByRole(role)
          .then((items) => {
            debug("apiGetMenuByRole OK. items(len)=", (items as any[])?.length, items);
            setMenuItems(items as MenuItem[]);
            setLoading(false);
          })
          .catch((e) => {
            error("apiGetMenuByRole ERROR:", e?.message, e?.response?.data || e);
            setLoading(false);
          });
      } catch (e) {
        error("Error parsing stored user:", e);
        setLoading(false);
      }
    } else {
      warn("No stored user in localStorage. Skipping menu fetch.");
      setLoading(false);
    }
  }, []);

  // Log cambios de loading y pathname
  useEffect(() => {
    debug("loading=", loading);
  }, [loading]);
  useEffect(() => {
    debug("pathname changed:", pathname);
  }, [pathname]);

  // Validación de items recibidos
  useEffect(() => {
    debug("menuItems updated. count=", menuItems.length);
    const check = (items: MenuItem[], parentKey?: string) => {
      items.forEach((it) => {
        const id = (it.key as string) || it.label;
        if (!it.label) warn("Item without label", { it, parentKey });
        if (!it.path) warn("Item without path", { id, it });
        if (!(it.icon in iconMap)) warn("Unknown icon key:", it.icon, { id });
        const childCount = Array.isArray(it.children) ? it.children.length : 0;
        debug("item:", { id, label: it.label, path: it.path, icon: it.icon, order: it.order, children: childCount });
        if (childCount > 0) check(it.children as MenuItem[], id);
      });
    };
    if (menuItems.length > 0) check(menuItems);
  }, [menuItems]);

  const navigate = (path?: string) => {
    if (!path) return;
    debug("navigate =>", path);
    setGlobalLoading(true, "Navegando...");
    router.push(path);
    // Pequeño timeout para dejar ver el loader hasta que el destino monte
    setTimeout(() => setGlobalLoading(false), 800);
  };

  const renderItem = (item: MenuItem) => {
    const Icon = iconMap[item.icon] || Menu;
    const active = item.path && pathname?.startsWith(item.path);
    const hasChildren = Array.isArray((item as any).children) && (item as any).children?.length > 0;
    const id = (item.key as string) || item.label;

    const buttonClasses = cn(
      "w-full justify-between h-11 text-sm font-medium",
      active ? "bg-secondary text-secondary-foreground" : "hover:bg-muted/60",
    );

    return (
      <div key={id} className="space-y-1">
        <Button
          variant={isExpanded(id) && hasChildren ? "secondary" : "ghost"}
          className={buttonClasses}
          onClick={() => {
            if (hasChildren) return toggleExpanded(id);
            if (item.path) navigate(item.path);
          }}
        >
          <span className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span className={cn(collapsed ? "hidden" : "block")}>{!collapsed && item.label}</span>
          </span>
          {!collapsed && hasChildren && (
            isExpanded(id) ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          )}
        </Button>

        {/* Submenú */}
        <AnimatePresence initial={false}>
          {!collapsed && hasChildren && isExpanded(id) ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="ml-2 space-y-1 border-l-2 border-border/50 pl-4"
            >
              {(item.children as MenuItem[]).map((c) => {
                const subActive = c.path && pathname?.startsWith(c.path);
                const subId = (c.key as string) || c.label;
                return (
                  <Button
                    key={subId}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-9 text-xs transition",
                      subActive
                        ? "bg-primary text-primary-foreground shadow-sm scale-[1.01]"
                        : "hover:bg-muted/50 hover:translate-x-1",
                    )}
                    onClick={() => c.path && navigate(c.path)}
                  >
                    <span className="w-2 h-2 rounded-full bg-current opacity-60 mr-2" />
                    {c.label}
                  </Button>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {/* Overlay móvil */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setCollapsed(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {(
          <motion.aside
            key="sidebar"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "border-r bg-card transition-all duration-300",
              // Móvil: panel fijo
              "fixed left-0 top-0 z-50 h-full w-80 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]",
              collapsed && "-translate-x-full lg:translate-x-0 lg:w-16",
              !collapsed && "translate-x-0 lg:w-64",
            )}
          >
            <div className="flex items-center justify-between px-4 py-4">
              {!collapsed && <span className="text-xl font-bold">Dashboard</span>}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col px-2 space-y-1 h-[calc(100%-64px)] overflow-y-auto">
              {loading ? (
                <span className="text-muted-foreground text-sm px-2">
                  Cargando menú...
                </span>
              ) : (
                menuItems.map((item) => renderItem(item))
              )}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
