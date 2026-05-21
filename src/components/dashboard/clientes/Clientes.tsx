"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListHeader } from "@/components/abm/ListHeader";
import { TableCard } from "@/components/abm/TableCard";
import { Pager } from "@/components/abm/Pager";
import { Pencil, Trash2, Users, UserCheck, UserPlus, Building2, CalendarPlus, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageStats, type PageStatItem } from "@/components/ui/PageStats";
import { EmptyState } from "@/components/ui/EmptyState";

export type Cliente = {
  id: string; // internal id
  nroCliente: string; // ClienteId
  nombre: string; // ClienteNombre
  fechaCreacion: string; // ClienteFchIns (ISO)
  ruc?: string; // ClienteRuc
  estado?: string; // ClienteEstado
  mail?: string; // ClienteMail
  tipo?: string; // ClienteTipo
  gci?: string; // ClienteGCI
};

const mockClientes: Cliente[] = Array.from({ length: 18 }).map((_, i) => ({
  id: String(i + 1),
  nroCliente: String(10000 + i),
  nombre: `Cliente ${i + 1}`,
  fechaCreacion: new Date(Date.now() - i * 86400000).toISOString(),
  ruc: i % 3 === 0 ? `2.345.67${i}-${i % 10}` : "",
  estado: i % 2 ? "Activo" : "Pendiente",
  mail: i % 2 ? `cliente${i}@mail.com` : "",
  tipo: i % 2 ? "Residencial" : "Comercial",
  gci: i % 2 ? "Sí" : "No",
}));

export default function Clientes() {
  const router = useRouter();
  const [items, setItems] = useState<Cliente[]>(mockClientes);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      [c.nroCliente, c.nombre, c.ruc, c.estado, c.mail, c.tipo, c.gci]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const onCreate = () => router.push("/dashboard/clientes/nuevo");
  const onEdit = (id: string) => router.push(`/dashboard/clientes/${id}`);
  const onDelete = (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    // TODO: API DELETE
    setItems((prev) => prev.filter((c) => c.id !== id));
  };

  // Stats contextuales
  const stats: PageStatItem[] = useMemo(() => {
    const total = items.length;
    const activos = items.filter((c) => c.estado === "Activo").length;
    const pendientes = items.filter((c) => c.estado === "Pendiente").length;
    const comerciales = items.filter((c) => c.tipo === "Comercial").length;
    const recientes = items.filter((c) => {
      const days = (Date.now() - new Date(c.fechaCreacion).getTime()) / 86400000;
      return days < 7;
    }).length;
    return [
      { id: "total",     label: "Total clientes", value: String(total),       icon: Users,        variant: "primary" },
      { id: "activos",   label: "Activos",        value: String(activos),     icon: UserCheck,    variant: "success" },
      { id: "pend",      label: "Pendientes",     value: String(pendientes),  icon: UserPlus,     variant: "warn" },
      { id: "comerc",    label: "Comerciales",    value: String(comerciales), icon: Building2,    variant: "primary" },
      { id: "rec",       label: "Últimos 7 días", value: String(recientes),   icon: CalendarPlus, variant: "success" },
    ];
  }, [items]);

  return (
    <>
    <PageStats items={stats} />
    <TableCard
      header={
        <ListHeader
          search={query}
          onSearch={(v) => { setQuery(v); setPage(1); }}
          onCreate={onCreate}
          createLabel="Nuevo"
        />
      }
    >
      <div className="overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nro Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Fecha Creación</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Mail</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>GCI</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/40">
                <TableCell className="font-medium whitespace-nowrap">{c.nroCliente}</TableCell>
                <TableCell className="whitespace-nowrap">{c.nombre}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(c.fechaCreacion).toLocaleString()}</TableCell>
                <TableCell>{c.ruc || "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.estado === "Activo" ? "default" : "secondary"}>{c.estado || "—"}</Badge>
                </TableCell>
                <TableCell className="truncate max-w-[260px]" title={c.mail || ""}>{c.mail || "—"}</TableCell>
                <TableCell>{c.tipo || "—"}</TableCell>
                <TableCell>{c.gci || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(c.id)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)} title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    icon={SearchX}
                    size="sm"
                    title="Sin clientes para mostrar"
                    description={query ? `No encontramos resultados para "${query}".` : "Aún no hay clientes cargados."}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pager
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        onFirst={() => setPage(1)}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onLast={() => setPage(totalPages)}
        onChangePageSize={(n) => { setPageSize(n); setPage(1); }}
      />
    </TableCard>
    </>
  );
}
