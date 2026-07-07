/* eslint-disable @typescript-eslint/no-explicit-any */
// Fake en memoria de PrismaService para tests unitarios de personas/hogar.
// No golpea ninguna base de datos real.
import { Prisma } from '@prisma/client';

type Row = Record<string, any>;

function matchWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      if ('in' in condition) return condition.in.includes(row[key]);
      if ('not' in condition) return row[key] !== condition.not;
      if ('gte' in condition) return row[key] >= condition.gte;
    }
    return row[key] === condition;
  });
}

// Calcula el próximo id como max(id)+1 en vez de un contador aparte, para que
// los fixtures de los specs puedan seedear ids manualmente sin colisionar.
function nextId(rows: Row[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

export class FakePrismaService {
  personas: Row[] = [];

  clienteUnis: Row[] = [];

  hogares: Row[] = [];

  hogarMiembros: Row[] = [];

  matchSugerencias: Row[] = [];

  coberturas: Row[] = [];

  private allTelefonos(): Row[] {
    return this.clienteUnis.flatMap((c) => c.telefonos ?? []);
  }

  private allDirecciones(): Row[] {
    return this.clienteUnis.flatMap((c) => c.direcciones ?? []);
  }

  private hydratePersona(p: Row, include?: Row): Row {
    const result: Row = { ...p };
    if (!include) return result;

    if (include.registros) {
      const registrosInclude = include.registros === true ? undefined : include.registros.include;
      result.registros = this.clienteUnis
        .filter((c) => c.personaId === p.id)
        .map((c) => {
          const registro: Row = { ...c };
          if (registrosInclude?.telefonos) registro.telefonos = c.telefonos ?? [];
          if (registrosInclude?.direcciones) registro.direcciones = c.direcciones ?? [];
          return registro;
        });
    }

    if (include.miembroDe) {
      const miembroDeInclude = include.miembroDe === true ? undefined : include.miembroDe.include;
      result.miembroDe = this.hogarMiembros
        .filter((m) => m.personaId === p.id)
        .map((m) => {
          const miembro: Row = { ...m };
          if (miembroDeInclude?.hogar) {
            miembro.hogar = this.hogares.find((h) => h.id === m.hogarId) ?? null;
          }
          return miembro;
        });
    }

    if (include.direccionPrincipal) {
      result.direccionPrincipal = p.direccionPrincipalId
        ? this.allDirecciones().find((d) => d.id === p.direccionPrincipalId) ?? null
        : null;
    }

    if (include.telefonoPrincipal) {
      result.telefonoPrincipal = p.telefonoPrincipalId
        ? this.allTelefonos().find((t) => t.id === p.telefonoPrincipalId) ?? null
        : null;
    }

    return result;
  }

  persona = {
    findUnique: async ({ where, include }: { where: { id: number }; include?: Row }) => {
      const p = this.personas.find((x) => x.id === where.id);
      if (!p) return null;
      return this.hydratePersona(p, include);
    },
    findFirst: async ({ where }: { where?: Row } = {}) => {
      const p = this.personas.find((x) => matchWhere(x, where));
      return p ? { ...p } : null;
    },
    findMany: async ({ where }: { where?: Row } = {}) => this.personas
      .filter((p) => matchWhere(p, where))
      .map((p) => ({ ...p })),
    create: async ({ data }: { data: Row }) => {
      const p: Row = {
        id: nextId(this.personas),
        nombreOficial: null,
        cedula: null,
        rucPrincipal: null,
        telefonoPrincipalId: null,
        direccionPrincipalId: null,
        estado: null,
        ...data,
      };
      this.personas.push(p);
      return { ...p };
    },
    update: async ({ where, data }: { where: { id: number }; data: Row }) => {
      const p = this.personas.find((x) => x.id === where.id);
      if (!p) throw new Error(`Persona ${where.id} no existe (fake)`);
      // Simula el índice único parcial uq_persona_cedula (cedula) WHERE cedula IS NOT NULL.
      if (data.cedula != null && this.personas.some((x) => x.id !== where.id && x.cedula === data.cedula)) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`cedula`)',
          { code: 'P2002', clientVersion: 'fake' },
        );
      }
      Object.assign(p, data);
      return { ...p };
    },
    delete: async ({ where }: { where: { id: number } }) => {
      const idx = this.personas.findIndex((x) => x.id === where.id);
      if (idx === -1) throw new Error(`Persona ${where.id} no existe (fake)`);
      const [removed] = this.personas.splice(idx, 1);
      return removed;
    },
  };

  clienteUni = {
    findUnique: async ({ where }: { where: { id: number } }) => {
      const c = this.clienteUnis.find((x) => x.id === where.id);
      return c ? { ...c } : null;
    },
    findMany: async ({ where }: { where?: Row } = {}) => this.clienteUnis
      .filter((c) => matchWhere(c, where))
      .map((c) => ({ ...c })),
    updateMany: async ({ where, data }: { where?: Row; data: Row }) => {
      const affected = this.clienteUnis.filter((c) => matchWhere(c, where));
      affected.forEach((c) => Object.assign(c, data));
      return { count: affected.length };
    },
    update: async ({ where, data }: { where: { id: number }; data: Row }) => {
      const c = this.clienteUnis.find((x) => x.id === where.id);
      if (!c) throw new Error(`ClienteUni ${where.id} no existe (fake)`);
      Object.assign(c, data);
      return { ...c };
    },
    count: async ({ where }: { where?: Row } = {}) => this.clienteUnis.filter((c) => matchWhere(c, where)).length,
  };

  clienteTelefono = {
    findFirst: async ({ where }: { where?: Row } = {}) => {
      const t = this.allTelefonos().find((x) => matchWhere(x, where));
      return t ? { ...t } : null;
    },
    findMany: async ({ where }: { where?: Row } = {}) => this.allTelefonos()
      .filter((t) => matchWhere(t, where))
      .map((t) => ({ ...t })),
  };

  cobertura = {
    findUnique: async (
      { where }: { where: { personaId_empresaFleteraId: { personaId: number; empresaFleteraId: number } } },
    ) => {
      const { personaId, empresaFleteraId } = where.personaId_empresaFleteraId;
      const c = this.coberturas.find((x) => x.personaId === personaId && x.empresaFleteraId === empresaFleteraId);
      return c ? { ...c } : null;
    },
    findMany: async ({ where }: { where?: Row } = {}) => this.coberturas
      .filter((c) => matchWhere(c, where))
      .map((c) => ({ ...c })),
    create: async ({ data }: { data: Row }) => {
      const c: Row = {
        id: nextId(this.coberturas),
        primeraFecha: null,
        cantPedidos: 0,
        ...data,
      };
      this.coberturas.push(c);
      return { ...c };
    },
    update: async (
      { where, data }: {
        where: {
          id?: number;
          personaId_empresaFleteraId?: { personaId: number; empresaFleteraId: number };
        };
        data: Row;
      },
    ) => {
      let c: Row | undefined;
      if (where.id != null) {
        c = this.coberturas.find((x) => x.id === where.id);
      } else if (where.personaId_empresaFleteraId) {
        const { personaId, empresaFleteraId } = where.personaId_empresaFleteraId;
        c = this.coberturas.find((x) => x.personaId === personaId && x.empresaFleteraId === empresaFleteraId);
      }
      if (!c) throw new Error('Cobertura no existe (fake)');
      Object.assign(c, data);
      return { ...c };
    },
    delete: async ({ where }: { where: { id: number } }) => {
      const idx = this.coberturas.findIndex((x) => x.id === where.id);
      if (idx === -1) throw new Error(`Cobertura ${where.id} no existe (fake)`);
      const [removed] = this.coberturas.splice(idx, 1);
      return removed;
    },
  };

  hogar = {
    findFirst: async ({ where }: { where?: Row }) => {
      const h = this.hogares.find((x) => matchWhere(x, where));
      return h ? { ...h } : null;
    },
    create: async ({ data }: { data: Row }) => {
      const h: Row = {
        id: nextId(this.hogares),
        etiqueta: null,
        direccionTextoNorm: null,
        lat: null,
        lng: null,
        ...data,
      };
      this.hogares.push(h);
      return { ...h };
    },
  };

  hogarMiembro = {
    findUnique: async ({ where }: { where: { hogarId_personaId: { hogarId: number; personaId: number } } }) => {
      const { hogarId, personaId } = where.hogarId_personaId;
      const m = this.hogarMiembros.find((x) => x.hogarId === hogarId && x.personaId === personaId);
      return m ? { ...m } : null;
    },
    findFirst: async ({ where }: { where?: Row } = {}) => {
      const m = this.hogarMiembros.find((x) => matchWhere(x, where));
      return m ? { ...m } : null;
    },
    findMany: async ({ where }: { where?: Row } = {}) => this.hogarMiembros
      .filter((m) => matchWhere(m, where))
      .map((m) => ({ ...m })),
    create: async ({ data }: { data: Row }) => {
      const m: Row = { id: nextId(this.hogarMiembros), rol: null, ...data };
      this.hogarMiembros.push(m);
      return { ...m };
    },
    update: async ({ where, data }: { where: { id: number }; data: Row }) => {
      const m = this.hogarMiembros.find((x) => x.id === where.id);
      if (!m) throw new Error(`HogarMiembro ${where.id} no existe (fake)`);
      Object.assign(m, data);
      return { ...m };
    },
    delete: async ({ where }: { where: { id: number } }) => {
      const idx = this.hogarMiembros.findIndex((x) => x.id === where.id);
      if (idx === -1) throw new Error(`HogarMiembro ${where.id} no existe (fake)`);
      const [removed] = this.hogarMiembros.splice(idx, 1);
      return removed;
    },
    upsert: async (
      { where, update, create }: {
        where: { hogarId_personaId: { hogarId: number; personaId: number } };
        update: Row;
        create: Row;
      },
    ) => {
      const { hogarId, personaId } = where.hogarId_personaId;
      const existente = this.hogarMiembros.find((x) => x.hogarId === hogarId && x.personaId === personaId);
      if (existente) {
        Object.assign(existente, update);
        return { ...existente };
      }
      const m: Row = { id: nextId(this.hogarMiembros), rol: null, ...create };
      this.hogarMiembros.push(m);
      return { ...m };
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = this.hogarMiembros.length;
      this.hogarMiembros = this.hogarMiembros.filter((m) => !matchWhere(m, where));
      return { count: before - this.hogarMiembros.length };
    },
  };

  matchSugerencia = {
    findUnique: async ({ where }: { where: { id: number } }) => {
      const s = this.matchSugerencias.find((x) => x.id === where.id);
      return s ? { ...s } : null;
    },
    findMany: async (
      { where, orderBy, skip = 0, take }: {
        where?: Row; orderBy?: { confianza?: 'asc' | 'desc' }; skip?: number; take?: number;
      } = {},
    ) => {
      let result = this.matchSugerencias.filter((s) => matchWhere(s, where)).map((s) => ({ ...s }));
      if (orderBy?.confianza === 'desc') {
        result = result.sort((a, b) => b.confianza - a.confianza);
      } else if (orderBy?.confianza === 'asc') {
        result = result.sort((a, b) => a.confianza - b.confianza);
      }
      if (take != null) {
        result = result.slice(skip, skip + take);
      } else if (skip) {
        result = result.slice(skip);
      }
      return result;
    },
    count: async ({ where }: { where?: Row } = {}) => this.matchSugerencias
      .filter((s) => matchWhere(s, where)).length,
    update: async ({ where, data }: { where: { id: number }; data: Row }) => {
      const s = this.matchSugerencias.find((x) => x.id === where.id);
      if (!s) throw new Error(`MatchSugerencia ${where.id} no existe (fake)`);
      Object.assign(s, data);
      return { ...s };
    },
  };

  $transaction = async <T>(fn: (tx: this) => Promise<T>): Promise<T> => fn(this);
}
