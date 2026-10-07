import { AlertParserAgentService } from './alert-parser-agent.service';

describe('AlertParserAgentService', () => {
  let service: AlertParserAgentService;

  beforeEach(() => {
    service = new AlertParserAgentService();
    
    // Mockearemos el método interno que llama a Genkit para efectos del test
    jest.spyOn(service as any, 'callGenkitLlm').mockImplementation(async (prompt: any) => {
      if (prompt.includes('75 euros')) {
        return {
          isComplete: true,
          parsedData: {
            originIata: 'MAD',
            destinationIata: 'LON',
            departureDay: 1,
            returnDay: 3,
            maxPriceEur: 75,
            startDate: '2026-11-01',
            endDate: '2026-11-30'
          }
        };
      }
      return {
        isComplete: false,
        clarificationMessage: '¿Cuál es tu presupuesto máximo y fechas de inicio/fin?'
      };
    });
  });

  describe('parsePrompt', () => {
    it('should return parsed data when the prompt contains all required entities', async () => {
      const prompt = 'Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles por menos de 75 euros entre el 2026-11-01 y el 2026-11-30';
      
      const result = await service.parsePrompt(prompt);

      expect(result.isComplete).toBe(true);
      expect(result.parsedData).toBeDefined();
      expect(result.parsedData?.originIata).toBe('MAD');
      expect(result.parsedData?.destinationIata).toBe('LON');
      expect(result.parsedData?.departureDay).toBe(1);
      expect(result.parsedData?.returnDay).toBe(3);
      expect(result.parsedData?.maxPriceEur).toBe(75);
    });

    it('EDGE CASE: Debería pedir clarificación si falta información clave (isComplete = false)', async () => {
      const prompt = 'Avísame de vuelos desde Madrid a París los lunes';
      
      const result = await service.parsePrompt(prompt);

      expect(result.isComplete).toBe(false);
      expect(result.parsedData).toBeUndefined();
      expect(result.clarificationMessage).toContain('presupuesto máximo');
    });
  });
});
