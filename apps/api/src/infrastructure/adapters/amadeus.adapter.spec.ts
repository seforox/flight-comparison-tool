import { AmadeusAdapter } from './amadeus.adapter';
import { FlightSearchQuery } from '../../domain/interfaces/flight-search.provider';

describe('AmadeusAdapter', () => {
  let adapter: AmadeusAdapter;

  beforeEach(() => {
    adapter = new AmadeusAdapter();
  });

  describe('searchFlights', () => {
    it('should map external API response to domain FlightSearchResult', async () => {
      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDate: '2026-11-01',
        returnDate: '2026-11-04'
      };

      const results = await adapter.searchFlights(query);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      const firstResult = results[0];
      expect(firstResult.departureDate).toEqual('2026-11-01');
      expect(firstResult.returnDate).toEqual('2026-11-04');
      expect(typeof firstResult.foundPriceEur).toBe('number');
      expect(firstResult.airlineCode).toBeDefined();
    });

    it('EDGE CASE: Respuestas vacías o con tarifas nulas desde la API externa (ruta inexistente)', async () => {
      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: 'XXX', // Mock configurado para devolver vacío
        departureDate: '2026-11-01',
        returnDate: '2026-11-04'
      };

      const results = await adapter.searchFlights(query);
      expect(results).toHaveLength(0);
    });

    it('EDGE CASE: Fallos por límite de cuota (HTTP 429) y caídas de red', async () => {
      const query: FlightSearchQuery = {
        originIata: 'MAD',
        destinationIata: '429', // Mock configurado para lanzar excepción 429
        departureDate: '2026-11-01',
        returnDate: '2026-11-04'
      };

      await expect(adapter.searchFlights(query)).rejects.toThrow('HTTP 429 Too Many Requests');
    });
  });
});
