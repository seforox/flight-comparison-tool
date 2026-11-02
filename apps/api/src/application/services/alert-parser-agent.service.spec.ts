import { AlertParserAgentService } from './alert-parser-agent.service';

describe('AlertParserAgentService (Multi-Skill Conversational Agent)', () => {
  let service: AlertParserAgentService;
  let mockPrisma: any;
  let mockScheduler: any;

  beforeEach(() => {
    process.env.USE_AGENT_MOCK = 'true';

    mockPrisma = {
      alert: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'created-alert-id-999',
          ...data,
        })),
      },
    };

    mockScheduler = {
      enqueueAlert: jest.fn().mockResolvedValue(1),
    };

    service = new AlertParserAgentService(mockPrisma, mockScheduler);
  });

  it('should load both SKILL.md files (defined-search and destination-recommender) from disk', () => {
    const skills = service.getLoadedSkills();
    expect(skills.DEFINED_SEARCH).toContain('name: defined-search');
    expect(skills.DESTINATION_RECOMMENDER).toContain('name: destination-recommender');
  });

  describe('Skill 1: DEFINED_SEARCH (Búsqueda Definida)', () => {
    it('should extract all fields and ask for confirmation when prompt is complete', async () => {
      const prompt =
        'Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles para 2 personas por menos de 75 euros entre el 2026-11-01 y el 2026-11-30';

      const result = await service.chat('user-1', prompt, 'session-defined-1');

      expect(result.activeSkill).toBe('DEFINED_SEARCH');
      expect(result.isComplete).toBe(true);
      expect(result.awaitingConfirmation).toBe(true);
      expect(result.parsedData).toEqual({
        originIata: 'MAD',
        destinationIata: 'LON',
        departureDay: 1,
        returnDay: 3,
        adults: 2,
        maxPriceEur: 75,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });
      expect(result.reply).toContain('¿Deseas que lance y active esta alerta');
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should create alert in DB and enqueue it automatically when user confirms ("sí, lánzala")', async () => {
      const sessionId = 'session-confirm-flow';
      await service.chat(
        'user-1',
        'Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles por menos de 75 euros entre el 2026-11-01 y el 2026-11-30',
        sessionId,
      );

      const confirmResult = await service.chat('user-1', 'Sí, lánzala', sessionId);

      expect(confirmResult.alertCreated).toBe(true);
      expect(confirmResult.createdAlertId).toBe('created-alert-id-999');
      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          originIata: 'MAD',
          destinationIata: 'LON',
          departureDay: 1,
          returnDay: 3,
          maxPriceEur: 75,
        }),
      });
      expect(mockScheduler.enqueueAlert).toHaveBeenCalledWith('created-alert-id-999');
    });

    it('EDGE CASE: Debería pedir clarificación si falta información clave (isComplete = false)', async () => {
      const prompt = 'Avísame de vuelos desde Madrid a París los lunes';

      const result = await service.chat('user-1', prompt, 'session-incomplete');

      expect(result.activeSkill).toBe('DEFINED_SEARCH');
      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toContain('presupuesto');
    });

    it('should deduce startDate and endDate from natural language month expressions ("en noviembre de este año")', async () => {
      const currentYear = new Date().getUTCFullYear();
      const prompt = 'Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles por menos de 85 euros en noviembre de este año';

      const result = await service.chat('user-1', prompt, 'session-month-deduction');

      expect(result.isComplete).toBe(true);
      expect(result.awaitingConfirmation).toBe(true);
      expect(result.parsedData?.startDate).toBe(`${currentYear}-11-01`);
      expect(result.parsedData?.endDate).toBe(`${currentYear}-11-30`);
    });
  });

  describe('Skill 2: DESTINATION_RECOMMENDER (Recomendador Inspiracional)', () => {
    it('should return 5 destination recommendations when user asks for beach/mountain/cheap ideas and ask follow-up questions', async () => {
      const prompt = 'Recomiéndame sitios baratos con playa para escaparme';

      const result = await service.chat('user-1', prompt, 'session-rec-1');

      expect(result.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(result.isComplete).toBe(false);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations).toHaveLength(5);
      expect(result.recommendations?.[0]).toEqual(
        expect.objectContaining({
          city: expect.any(String),
          iataCode: expect.any(String),
          country: expect.any(String),
          estimatedPriceEur: expect.any(Number),
          reason: expect.any(String),
        }),
      );
      expect(result.reply).toContain('¿Cuál de estos 5 destinos te gustaría elegir');
    });

    it('should transition from DESTINATION_RECOMMENDER to DEFINED_SEARCH across turns until confirmation', async () => {
      const sessionId = 'session-multi-turn-rec';

      // Turno 1: Pide recomendaciones de montaña
      const turn1 = await service.chat('user-1', 'Busco sitios baratos de montaña', sessionId);
      expect(turn1.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn1.recommendations).toHaveLength(5);

      // Turno 2: Elige uno de los destinos recomendados y da el resto de datos
      const turn2 = await service.chat(
        'user-1',
        'Me quedo con Ginebra (GVA) saliendo desde MAD de viernes a domingo por menos de 90 euros entre 2026-12-01 y 2026-12-31',
        sessionId,
      );
      expect(turn2.activeSkill).toBe('DEFINED_SEARCH');
      expect(turn2.isComplete).toBe(true);
      expect(turn2.awaitingConfirmation).toBe(true);
      expect(turn2.parsedData?.destinationIata).toBe('GVA');
      expect(turn2.parsedData?.originIata).toBe('MAD');

      // Turno 3: Confirma creación y encolado automático
      const turn3 = await service.chat('user-1', 'Sí, adelante', sessionId);
      expect(turn3.alertCreated).toBe(true);
      expect(mockScheduler.enqueueAlert).toHaveBeenCalledWith('created-alert-id-999');
    });
  });
});
