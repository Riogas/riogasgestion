/* eslint-disable @typescript-eslint/no-explicit-any */
export type Rol = 'CALL_CENTER' | 'DISTRIBUIDOR';

export interface FichaCompleta {
  persona: {
    nombreOficial?: string | null;
    estado?: string | null;
    cedula?: string | null;
    [k: string]: unknown;
  };
  telefonos: any[];
  direcciones: any[];
  hogares: any[];
  observaciones?: string | null;
}

export interface FichaRedactada {
  nombre: string;
  estado?: string;
  cedula?: string;
  telefono?: any;
  direccion?: any;
  scope: 'MINIMA' | 'AFILIADA' | 'COMPLETA';
}

// Ordena por ultFecha desc (nulls al final) y devuelve el primero.
function masReciente(items: any[]): any {
  if (!items || items.length === 0) return undefined;
  const ordenados = [...items].sort((a, b) => {
    const fa = a?.ultFecha ? new Date(a.ultFecha).getTime() : -Infinity;
    const fb = b?.ultFecha ? new Date(b.ultFecha).getTime() : -Infinity;
    return fb - fa;
  });
  return ordenados[0];
}

export function redactar(f: FichaCompleta, rol: Rol, afiliado: boolean): FichaRedactada {
  const nombre = f.persona.nombreOficial ?? '';
  const estado = f.persona.estado ?? undefined;
  const cedula = f.persona.cedula ?? undefined;

  if (rol === 'CALL_CENTER') {
    return {
      nombre,
      estado,
      cedula,
      telefono: f.telefonos,
      direccion: f.direcciones,
      scope: 'COMPLETA',
    };
  }

  if (!afiliado) {
    return { nombre, scope: 'MINIMA' };
  }

  // INVARIANTE PENDIENTE (spec §6): acá deberíamos filtrar f.telefonos /
  // f.direcciones a los registros vinculados a la cobertura del
  // empresaFleteraId que está consultando, antes de aplicar masReciente.
  // Hoy tomamos el más reciente de TODOS los registros de la persona
  // (cualquier distribuidor), porque el vínculo tel/dir↔distribuidor y el
  // poblado de ultFecha todavía no existen (dependen del subsistema de
  // Pedidos, futuro). Cuando esos datos existan, filtrar por
  // empresaFleteraId acá es obligatorio para no filtrar teléfono/dirección
  // de un cliente hacia un distribuidor que nunca lo atendió.
  return {
    nombre,
    estado,
    cedula,
    telefono: masReciente(f.telefonos),
    direccion: masReciente(f.direcciones),
    scope: 'AFILIADA',
  };
}
