import { IgnavAdapter } from './ignav.adapter';
import { FlightSearchQuery } from '../../domain/interfaces/flight-search.provider';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IgnavAdapter', () => {
  let adapter: IgnavAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USE_IGNAV_MOCK = 'true';
    process.env.IGNAV_API_KEY = 'test-ignav-key';
    adapter = new IgnavAdapter();
  });

  describe('searchFlights (Mock Mode)', () => {
    it('should map Ignav mock response to domain FlightSearchResult', async () => {
      const logSpy = jest.spyOn((adapter as any).logger, 'log');
      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
      };

      const results = await adapter.searchFlights(query);

      expect(logSpy).toHaveBeenCalledWith(
        '[TEST MODE] Buscando vuelos simulados en el comparador de vuelos para MAD -> LON (2026-11-01 a 2026-11-04, 1 pax)',
      );
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(1);

      const firstResult = results[0];
      expect(firstResult.departureDate).toEqual('2026-11-01');
      expect(firstResult.returnDate).toEqual('2026-11-04');
      expect(typeof firstResult.foundPriceEur).toBe('number');
      expect(firstResult.airlineCode).toBe('Ryanair');
      expect(firstResult.isDirect).toBe(true);
      expect(firstResult.departureTime).toBe('08:30');
      expect(firstResult.durationMinutes).toBe(150);
    });

    it('EDGE CASE: Respuestas vacías o con tarifas nulas desde la API externa (ruta inexistente)', async () => {
      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: 'XXX',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
      };

      const results = await adapter.searchFlights(query);
      expect(results).toHaveLength(0);
    });

    it('EDGE CASE: Fallos por límite de cuota (HTTP 429) y caídas de red', async () => {
      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: '429',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04',
      };

      await expect(adapter.searchFlights(query)).rejects.toThrow('HTTP 429 Too Many Requests');
    });
  });

  describe('searchFlights (Real Mode)', () => {
    it('should call real Ignav Round-Trip API with X-Api-Key and map response when USE_IGNAV_MOCK=false', async () => {
      process.env.USE_IGNAV_MOCK = 'false';
      const logSpy = jest.spyOn((adapter as any).logger, 'log');

      mockedAxios.post.mockResolvedValue({
        data: {
          itineraries: [
            {
              price: { amount: 72.4, currency: 'EUR' },
              outbound: {
                carrier: 'Iberia',
                segments: [{ marketing_carrier_code: 'IB' }],
              },
              ignav_id: 'ignav_hash_123',
            },
          ],
        },
      });

      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: 'BCN',
        departureDate: '2026-11-10',
        returnDate: '2026-11-12',
        adults: 2,
      };

      const results = await adapter.searchFlights(query);

      expect(logSpy).toHaveBeenCalledWith(
        'Ejecutando llamada al comparador de vuelos para MAD -> BCN (2026-11-10 a 2026-11-12, 2 pax)',
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://ignav.com/api/fares/round-trip',
        {
          origin: 'MAD',
          destination: 'BCN',
          departure_date: '2026-11-10',
          return_date: '2026-11-12',
          adults: 2,
          cabin_class: 'economy',
          market: 'ES',
        },
        {
          headers: {
            'X-Api-Key': 'test-ignav-key',
            'Content-Type': 'application/json',
          },
        },
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          departureDate: '2026-11-10',
          returnDate: '2026-11-12',
          foundPriceEur: 72.4,
          airlineCode: 'Iberia',
          isDirect: true,
          stopsCount: 0,
          bookingUrl: expect.stringContaining('MAD'),
        }),
      );
    });
  });
});
