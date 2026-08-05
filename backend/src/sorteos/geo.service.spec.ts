import { GeoService } from './geo.service';

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}));

import * as geoip from 'geoip-lite';

const mockLookup = geoip.lookup as jest.MockedFunction<typeof geoip.lookup>;

describe('GeoService', () => {
  let service: GeoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeoService();
  });

  // ─── porIp ────────────────────────────────────────────────────────────────

  describe('porIp', () => {
    it('sin ip → {}', () => {
      expect(service.porIp(undefined)).toEqual({});
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it('IP privada (geoip-lite no la resuelve) → {}', () => {
      mockLookup.mockReturnValue(null);

      expect(service.porIp('192.168.1.1')).toEqual({});
    });

    it('IP pública conocida devuelve país/región/ciudad', () => {
      mockLookup.mockReturnValue({
        range: [0, 1],
        country: 'UY',
        region: 'MO',
        eu: '0',
        timezone: 'America/Montevideo',
        city: 'Montevideo',
        ll: [-34.9, -56.2],
        metro: 0,
        area: 5,
      });

      expect(service.porIp('190.64.1.2')).toEqual({
        ipPais: 'UY',
        ipRegion: 'MO',
        ipCiudad: 'Montevideo',
      });
    });

    it('si geoip-lite lanza, nunca propaga el error → {}', () => {
      mockLookup.mockImplementation(() => {
        throw new Error('boom');
      });

      expect(service.porIp('190.64.1.2')).toEqual({});
    });
  });

  // ─── reverse ──────────────────────────────────────────────────────────────

  describe('reverse', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('fetch ok mapea address a país/departamento/localidad', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          address: { country: 'Uruguay', state: 'Montevideo', city: 'Pocitos' },
        }),
      }) as unknown as typeof fetch;

      await expect(service.reverse(-34.9011, -56.1645)).resolves.toEqual({
        gpsPais: 'Uruguay',
        gpsDepartamento: 'Montevideo',
        gpsLocalidad: 'Pocitos',
      });
    });

    it('usa town o village si no viene city', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          address: { country: 'Uruguay', state: 'Canelones', town: 'Las Piedras' },
        }),
      }) as unknown as typeof fetch;

      await expect(service.reverse(-34.7, -56.2)).resolves.toEqual({
        gpsPais: 'Uruguay',
        gpsDepartamento: 'Canelones',
        gpsLocalidad: 'Las Piedras',
      });
    });

    it('respuesta no ok → {}', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

      await expect(service.reverse(-34.9, -56.1)).resolves.toEqual({});
    });

    it('fetch que lanza (timeout/red) → {}', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;

      await expect(service.reverse(-34.9, -56.1)).resolves.toEqual({});
    });
  });
});
