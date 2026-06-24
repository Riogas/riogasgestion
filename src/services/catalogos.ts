import { api } from "@/lib/axios";
import type {
  TipoClienteOption,
  CategoriaPrecioOption,
  DepartamentoOption,
  LocalidadOption,
  ZonaOption,
  PuestoOption,
} from "@/lib/types/cliente";

export async function getTiposCliente(): Promise<TipoClienteOption[]> {
  const { data } = await api.get<TipoClienteOption[]>("/catalogos/tipos-cliente");
  return data;
}

export async function getCategoriasPrecio(): Promise<CategoriaPrecioOption[]> {
  const { data } = await api.get<CategoriaPrecioOption[]>(
    "/catalogos/categorias-precio",
  );
  return data;
}

export async function getDepartamentos(): Promise<DepartamentoOption[]> {
  const { data } = await api.get<DepartamentoOption[]>("/catalogos/departamentos");
  return data;
}

export async function getLocalidades(
  departamentoId?: number,
): Promise<LocalidadOption[]> {
  const { data } = await api.get<LocalidadOption[]>("/catalogos/localidades", {
    params: departamentoId !== undefined ? { departamentoId } : undefined,
  });
  return data;
}

export async function getZonas(puestoId?: number): Promise<ZonaOption[]> {
  const { data } = await api.get<ZonaOption[]>("/catalogos/zonas", {
    params: puestoId !== undefined ? { puestoId } : undefined,
  });
  return data;
}

export async function getPuestos(): Promise<PuestoOption[]> {
  const { data } = await api.get<PuestoOption[]>("/catalogos/puestos");
  return data;
}
