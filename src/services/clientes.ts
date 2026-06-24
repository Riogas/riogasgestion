import { api } from "@/lib/axios";
import type {
  Cliente,
  ClienteTelefono,
  ClienteDireccion,
  PaginatedClientes,
  QueryClientesParams,
  ClienteFormValues,
  CreateClienteFormValues,
  TelefonoFormValues,
  DireccionFormValues,
} from "@/lib/types/cliente";

// ─── Clientes CRUD ────────────────────────────────────────────────────────────

export async function getClientes(
  params?: QueryClientesParams,
): Promise<PaginatedClientes> {
  const { data } = await api.get<PaginatedClientes>("/clientes", { params });
  return data;
}

export async function getCliente(id: number | string): Promise<Cliente> {
  const { data } = await api.get<Cliente>(`/clientes/${id}`);
  return data;
}

export async function createCliente(
  dto: CreateClienteFormValues,
): Promise<Cliente> {
  const { data } = await api.post<Cliente>("/clientes", dto);
  return data;
}

export async function updateCliente(
  id: number | string,
  dto: Partial<ClienteFormValues>,
): Promise<Cliente> {
  const { data } = await api.patch<Cliente>(`/clientes/${id}`, dto);
  return data;
}

export async function deleteCliente(
  id: number | string,
): Promise<{ id: number; estado: string }> {
  const { data } = await api.delete<{ id: number; estado: string }>(
    `/clientes/${id}`,
  );
  return data;
}

// ─── Teléfonos ────────────────────────────────────────────────────────────────

export async function addTelefono(
  clienteId: number | string,
  dto: TelefonoFormValues,
): Promise<ClienteTelefono> {
  const { data } = await api.post<ClienteTelefono>(
    `/clientes/${clienteId}/telefonos`,
    dto,
  );
  return data;
}

export async function updateTelefono(
  clienteId: number | string,
  telId: number | string,
  dto: Partial<TelefonoFormValues>,
): Promise<ClienteTelefono> {
  const { data } = await api.patch<ClienteTelefono>(
    `/clientes/${clienteId}/telefonos/${telId}`,
    dto,
  );
  return data;
}

export async function removeTelefono(
  clienteId: number | string,
  telId: number | string,
): Promise<void> {
  await api.delete(`/clientes/${clienteId}/telefonos/${telId}`);
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function addDireccion(
  clienteId: number | string,
  dto: DireccionFormValues,
): Promise<ClienteDireccion> {
  const { data } = await api.post<ClienteDireccion>(
    `/clientes/${clienteId}/direcciones`,
    dto,
  );
  return data;
}

export async function updateDireccion(
  clienteId: number | string,
  dirId: number | string,
  dto: Partial<DireccionFormValues>,
): Promise<ClienteDireccion> {
  const { data } = await api.patch<ClienteDireccion>(
    `/clientes/${clienteId}/direcciones/${dirId}`,
    dto,
  );
  return data;
}

export async function removeDireccion(
  clienteId: number | string,
  dirId: number | string,
): Promise<void> {
  await api.delete(`/clientes/${clienteId}/direcciones/${dirId}`);
}
