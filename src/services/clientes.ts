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

export async function getCliente(id: string): Promise<Cliente> {
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
  id: string,
  dto: Partial<ClienteFormValues>,
): Promise<Cliente> {
  const { data } = await api.patch<Cliente>(`/clientes/${id}`, dto);
  return data;
}

export async function deleteCliente(id: string): Promise<void> {
  await api.delete(`/clientes/${id}`);
}

// ─── Teléfonos ────────────────────────────────────────────────────────────────

export async function addTelefono(
  clienteId: string,
  dto: TelefonoFormValues,
): Promise<ClienteTelefono> {
  const { data } = await api.post<ClienteTelefono>(
    `/clientes/${clienteId}/telefonos`,
    dto,
  );
  return data;
}

export async function updateTelefono(
  clienteId: string,
  telId: string,
  dto: Partial<TelefonoFormValues>,
): Promise<ClienteTelefono> {
  const { data } = await api.patch<ClienteTelefono>(
    `/clientes/${clienteId}/telefonos/${telId}`,
    dto,
  );
  return data;
}

export async function removeTelefono(
  clienteId: string,
  telId: string,
): Promise<void> {
  await api.delete(`/clientes/${clienteId}/telefonos/${telId}`);
}

// ─── Direcciones ──────────────────────────────────────────────────────────────

export async function addDireccion(
  clienteId: string,
  dto: DireccionFormValues,
): Promise<ClienteDireccion> {
  const { data } = await api.post<ClienteDireccion>(
    `/clientes/${clienteId}/direcciones`,
    dto,
  );
  return data;
}

export async function updateDireccion(
  clienteId: string,
  dirId: string,
  dto: Partial<DireccionFormValues>,
): Promise<ClienteDireccion> {
  const { data } = await api.patch<ClienteDireccion>(
    `/clientes/${clienteId}/direcciones/${dirId}`,
    dto,
  );
  return data;
}

export async function removeDireccion(
  clienteId: string,
  dirId: string,
): Promise<void> {
  await api.delete(`/clientes/${clienteId}/direcciones/${dirId}`);
}
