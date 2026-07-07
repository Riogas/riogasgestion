import { PrismaService } from '../prisma/prisma.service';
import { FakePrismaService } from '../personas/__tests__/prisma-fake';
import { CoberturaService } from './cobertura.service';

describe('CoberturaService', () => {
  let fake: FakePrismaService;
  let service: CoberturaService;

  beforeEach(() => {
    fake = new FakePrismaService();
    service = new CoberturaService(fake as unknown as PrismaService);
  });

  describe('upsertInteraccion', () => {
    it('crea la cobertura con cantPedidos=1 en el primer upsert', async () => {
      const fecha = new Date('2026-01-01');

      const cobertura = await service.upsertInteraccion({
        personaId: 1, puestoId: 10, empresaFleteraId: 100, tipo: 'LLAMADA_DIRECTA', fecha,
      });

      expect(cobertura.cantPedidos).toBe(1);
      expect(cobertura.primeraFecha).toEqual(fecha);
      expect(cobertura.ultFecha).toEqual(fecha);
      expect(cobertura.tipoInteraccion).toBe('LLAMADA_DIRECTA');
    });

    it('en el segundo upsert con fecha mayor sube ultFecha y cantPedidos, sin tocar primeraFecha', async () => {
      const primeraFecha = new Date('2026-01-01');
      const segundaFecha = new Date('2026-02-01');

      await service.upsertInteraccion({
        personaId: 1, puestoId: 10, empresaFleteraId: 100, tipo: 'LLAMADA_DIRECTA', fecha: primeraFecha,
      });
      const cobertura = await service.upsertInteraccion({
        personaId: 1, puestoId: 10, empresaFleteraId: 100, tipo: 'ENTREGA_MOVIL', fecha: segundaFecha,
      });

      expect(cobertura.cantPedidos).toBe(2);
      expect(cobertura.ultFecha).toEqual(segundaFecha);
      expect(cobertura.primeraFecha).toEqual(primeraFecha);
      expect(cobertura.tipoInteraccion).toBe('ENTREGA_MOVIL');
    });

    it('no retrocede ultFecha si la nueva interacción es más vieja que la registrada', async () => {
      const fechaReciente = new Date('2026-03-01');
      const fechaVieja = new Date('2026-01-01');

      await service.upsertInteraccion({
        personaId: 1, puestoId: 10, empresaFleteraId: 100, tipo: 'LLAMADA_DIRECTA', fecha: fechaReciente,
      });
      const cobertura = await service.upsertInteraccion({
        personaId: 1, puestoId: 10, empresaFleteraId: 100, tipo: 'LLAMADA_DIRECTA', fecha: fechaVieja,
      });

      expect(cobertura.ultFecha).toEqual(fechaReciente);
      expect(cobertura.cantPedidos).toBe(2);
    });
  });

  describe('tieneAfiliacion', () => {
    it('es false si la persona nunca interactuó con la empresa fletera', async () => {
      await expect(service.tieneAfiliacion(1, 100)).resolves.toBe(false);
    });

    it('es true después de registrar una interacción', async () => {
      await service.upsertInteraccion({
        personaId: 1, puestoId: 10, empresaFleteraId: 100, tipo: 'LLAMADA_DIRECTA', fecha: new Date('2026-01-01'),
      });

      await expect(service.tieneAfiliacion(1, 100)).resolves.toBe(true);
    });
  });
});
