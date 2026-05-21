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
  const [manualCollapsed, setManualCollapsed] = useState<string[]>([]); // padres que el usuario colapsó manualmente
  const [manualExpanded, setManualExpanded] = useState<string[]>([]);   // padres que el usuario abrió manualmente (persistir)
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading: setGlobalLoading } = useLoading();

  const debug = (...args: any[]) => console.log("[Sidebar]", ...args);
  const warn = (...args: any[]) => console.warn("[Sidebar]", ...args);
  const error = (...args: any[]) => console.error("[Sidebar]", ...args);

  // Estado abierto móvil: aprovechamos collapsed como trigger (cuando no está colapsado se muestra)
  const isMobileOpen = useMemo(() => !collapsed, [collapsed]);

  // Clave en localStorage para recordar qué padres el usuario decidió cerrar
  const MANUAL_COLLAPSED_KEY = "sidebarManualCollapsed";
  const MANUAL_EXPANDED_KEY = "sidebarManualExpanded";

  // Cargar preferencias de colapsado / expandido manual al montar
  useEffect(() => {
    try {
      const storedCollapsed = typeof window !== "undefined" ? localStorage.getItem(MANUAL_COLLAPSED_KEY) : null;
      if (storedCollapsed) {
        const arr = JSON.parse(storedCollapsed);
        if (Array.isArray(arr)) setManualCollapsed(arr);
      }
      const storedExpanded = typeof window !== "undefined" ? localStorage.getItem(MANUAL_EXPANDED_KEY) : null;
      if (storedExpanded) {
        const arrE = JSON.parse(storedExpanded);
        if (Array.isArray(arrE)) setManualExpanded(arrE);
      }
    } catch (e) { warn("No se pudieron parsear preferencias de sidebar", e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar cambios
  useEffect(() => { try { if (typeof window !== "undefined") localStorage.setItem(MANUAL_COLLAPSED_KEY, JSON.stringify(manualCollapsed)); } catch {} }, [manualCollapsed]);
  useEffect(() => { try { if (typeof window !== "undefined") localStorage.setItem(MANUAL_EXPANDED_KEY, JSON.stringify(manualExpanded)); } catch {} }, [manualExpanded]);

  // Función para obtener los IDs (keys) de los padres cuyo subtree contiene la ruta activa
  const getParentsOfActivePath = (items: MenuItem[], path?: string): string[] => {
    if (!path) return [];
    const parents: string[] = [];
    const visit = (nodes: MenuItem[], ancestors: string[]) => {
      nodes.forEach((n) => {
        const id = (n.key as string) || n.label;
        const hasChildren = Array.isArray(n.children) && n.children.length > 0;
        const selfMatch = n.path && path.startsWith(n.path);
        if (hasChildren) {
          const beforeLen = parents.length;
          visit(n.children as MenuItem[], [...ancestors, id]);
          const afterLen = parents.length;
          if (afterLen > beforeLen || selfMatch) {
            ancestors.forEach(a => { if (!parents.includes(a)) parents.push(a); });
            if (!parents.includes(id)) parents.push(id);
          } else if (selfMatch) {
            ancestors.forEach(a => { if (!parents.includes(a)) parents.push(a); });
            if (!parents.includes(id)) parents.push(id);
          }
        } else if (selfMatch) {
          ancestors.forEach(a => { if (!parents.includes(a)) parents.push(a); });
        }
      });
    };
    visit(items, []);
    return parents;
  };

  // Memo de padres activos
  const activeParents = useMemo(() => getParentsOfActivePath(menuItems, pathname), [menuItems, pathname]);

  // Sincronizar expanded: solo añadimos padres activos y mantenemos/removemos según manualCollapsed sin reconstruir todo para evitar reapertura inmediata
  useEffect(() => {
    if (menuItems.length === 0) return;
    setExpanded(prev => {
      const next = new Set(prev);
      // Asegurar padres activos abiertos (si no han sido colapsados manualmente)
      activeParents.forEach(p => {
        if (manualCollapsed.includes(p)) {
          next.delete(p); // usuario decidió cerrarlo
        } else {
          next.add(p); // auto-open
        }
      });
      // Añadir manualmente expandidos (aunque no sean padres activos)
      manualExpanded.forEach(p => next.add(p));
      // Remover cualquiera que esté en manualCollapsed explícitamente
      manualCollapsed.forEach(p => next.delete(p));
      return Array.from(next);
    });
  }, [menuItems, activeParents, manualCollapsed, manualExpanded]);

  const isExpanded = (id: string) => expanded.includes(id);
  const toggleExpanded = (id: string) => {
    const isActiveParent = activeParents.includes(id);
    const currentlyExpanded = expanded.includes(id);

    // Actualizar listas persistentes según intención del usuario
    if (currentlyExpanded) {
      // Usuario colapsa
      if (isActiveParent) {
        // marcar que lo cerró manualmente para no auto-abrir
        setManualCollapsed(prev => prev.includes(id) ? prev : [...prev, id]);
      } else {
        // quitar de manualExpanded si estaba
        setManualExpanded(prev => prev.filter(x => x !== id));
      }
    } else {
      // Usuario expande
      if (isActiveParent) {
        // por si estaba registrado como colapsado manual lo removemos
        setManualCollapsed(prev => prev.filter(x => x !== id));
      } else {
        // recordar expansión manual
        setManualExpanded(prev => prev.includes(id) ? prev : [...prev, id]);
      }
    }

    setExpanded(prev => currentlyExpanded ? prev.filter(i => i !== id) : [...prev, id]);
  };

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

  const submenuContainerVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: "auto",
      transition: { when: "beforeChildren", staggerChildren: 0.05, delayChildren: 0.02 },
    },
    exit: { opacity: 0, height: 0, transition: { when: "afterChildren", duration: 0.15 } },
  } as const;

  // Usamos funciones + casting a any para evitar conflicto de tipos con Variants (Framer no tipa bien funciones custom + ease array)
  const submenuItemVariants: any = {
    hidden: { opacity: 0, y: -6, filter: "blur(2px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.22, ease: [0.25, 0.8, 0.3, 1] } },
    exit: { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.12 } },
  } as const;

  const renderItem = (item: MenuItem) => {
    const Icon = iconMap[item.icon] || Menu;
    const active = item.path && pathname?.startsWith(item.path);
    const hasChildren = Array.isArray((item as any).children) && (item as any).children?.length > 0;
    const id = (item.key as string) || item.label;

    const buttonClasses = cn(
      "w-full justify-between h-10 text-sm font-medium rounded-[var(--radius-md)]",
      // Active item: brand-primary tint + 3px left stripe
      active
        ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_var(--primary)] hover:bg-primary/15"
        : "text-foreground hover:bg-muted/70",
    );

    return (
      <div key={id} className="space-y-1">
        <Button
          variant="ghost"
          className={buttonClasses}
          onClick={() => {
            if (hasChildren) return toggleExpanded(id);
            if (item.path) navigate(item.path);
          }}
          aria-current={active ? "page" : undefined}
          title={collapsed ? item.label : undefined}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
            <span className={cn(collapsed ? "hidden" : "block truncate")}>{!collapsed && item.label}</span>
          </span>
          {!collapsed && hasChildren && (
            isExpanded(id) ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )
          )}
        </Button>

        {/* Submenú */}
        <AnimatePresence initial={false}>
          {!collapsed && hasChildren && isExpanded(id) ? (
            <motion.div
              variants={submenuContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ originY: 0 }}
              className="ml-2 space-y-1 border-l-2 border-border/50 pl-4"
              data-auto-open={activeParents.includes(id) && !manualCollapsed.includes(id)}
            >
              {(item.children as MenuItem[]).map((c, idx) => {
                const subActive = c.path && pathname?.startsWith(c.path);
                const subId = (c.key as string) || c.label;
                const SubIcon = iconMap[c.icon as keyof typeof iconMap] || Menu;
                return (
                  <motion.div
                    key={subId}
                    variants={submenuItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={{ originY: 0 }}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start h-9 text-xs rounded-[var(--radius-md)] transition-all duration-150",
                        subActive
                          ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_var(--primary)] font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-0.5",
                      )}
                      onClick={() => c.path && navigate(c.path)}
                      aria-current={subActive ? "page" : undefined}
                    >
                      <SubIcon className={cn("w-3.5 h-3.5 mr-2", subActive ? "text-primary opacity-100" : "opacity-70")} />
                      {c.label}
                    </Button>
                  </motion.div>
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
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
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
              "surface-glass-strong border-r border-border transition-all duration-300",
              // Móvil: panel fijo
              "fixed left-0 top-0 z-50 h-full w-72 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]",
              collapsed && "-translate-x-full lg:translate-x-0 lg:w-16",
              !collapsed && "translate-x-0 lg:w-60",
            )}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60">
              {!collapsed && (
                <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Menú
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex flex-col px-2 py-3 space-y-0.5 h-[calc(100%-49px)] overflow-y-auto overflow-x-hidden">
              {loading ? (
                <div className="px-3 py-2 space-y-2">
                  <div className="h-8 rounded-md bg-muted/60 animate-shimmer" />
                  <div className="h-8 rounded-md bg-muted/60 animate-shimmer" />
                  <div className="h-8 rounded-md bg-muted/60 animate-shimmer" />
                </div>
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
