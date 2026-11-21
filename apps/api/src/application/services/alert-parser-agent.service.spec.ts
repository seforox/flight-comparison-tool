import { AlertParserAgentService } from './alert-parser-agent.service';

describe('AlertParserAgentService (Multi-Skill Conversational Agent)', () => {
  let service: AlertParserAgentService;
  let mockPrisma: any;
  let mockScheduler: any;

  beforeEach(() => {
    process.env.USE_AGENT_MOCK = 'true';
    process.env.USE_IGNAV_MOCK = 'true';

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
    it('should extract all fields (including directOnly and budgetType when >1 passenger) and ask for confirmation when prompt is complete', async () => {
      const prompt =
        'Vuelos directos de MAD a LON saliendo el lunes y volviendo el miercoles para 2 personas por menos de 75 euros en total entre el 2026-11-01 y el 2026-11-30';

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
        directOnly: true,
        maxPriceEur: 75,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });
      expect(result.reply).toContain('¿Deseas que lance y active esta alerta');
      expect(result.reply).not.toContain('**');
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should ask whether maxPriceEur is per person or total when adults > 1 and apply it to search', async () => {
      const prompt =
        'Vuelos directos de MAD a LON saliendo el lunes y volviendo el miercoles para 2 personas por menos de 75 euros entre el 2026-11-01 y el 2026-11-30';

      // Turno 1: Falta saber si 75 EUR es por persona o total
      const turn1 = await service.chat('user-1', prompt, 'session-budget-per-person');
      expect(turn1.isComplete).toBe(false);
      expect(turn1.reply).toContain('máximo por persona o máximo total');

      // Turno 2: El usuario responde "Máximo por persona" -> 75 * 2 = 150 EUR total para la búsqueda
      const turn2 = await service.chat('user-1', 'Máximo por persona', 'session-budget-per-person');
      expect(turn2.isComplete).toBe(true);
      expect(turn2.awaitingConfirmation).toBe(true);
      expect(turn2.parsedData?.maxPriceEur).toBe(150);
      expect(turn2.reply).toContain('150 EUR en total (75 EUR por persona)');
    });

    it('should ask whether the user wants direct flight or with layovers if not specified', async () => {
      const prompt =
        'Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles para 1 persona por menos de 75 euros entre el 2026-11-01 y el 2026-11-30';

      const turn1 = await service.chat('user-1', prompt, 'session-missing-direct');

      expect(turn1.isComplete).toBe(false);
      expect(turn1.reply).toContain('vuelo directo o con escalas');

      const turn2 = await service.chat('user-1', 'Con escalas', 'session-missing-direct');
      expect(turn2.isComplete).toBe(true);
      expect(turn2.awaitingConfirmation).toBe(true);
      expect(turn2.parsedData?.directOnly).toBe(false);
    });

    it('should create alert in DB and enqueue it automatically when user confirms ("sí, lánzala")', async () => {
      const sessionId = 'session-confirm-flow';
      await service.chat(
        'user-1',
        'Vuelos directos de MAD a LON saliendo el lunes y volviendo el miercoles por menos de 75 euros entre el 2026-11-01 y el 2026-11-30',
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
          directOnly: true,
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
      const prompt = 'Vuelos directos de MAD a LON saliendo el lunes y volviendo el miercoles por menos de 85 euros en noviembre de este año';

      const result = await service.chat('user-1', prompt, 'session-month-deduction');

      expect(result.isComplete).toBe(true);
      expect(result.awaitingConfirmation).toBe(true);
      expect(result.parsedData?.startDate).toBe(`${currentYear}-11-01`);
      expect(result.parsedData?.endDate).toBe(`${currentYear}-11-30`);
    });
  });

  describe('Skill 2: DESTINATION_RECOMMENDER (Recomendador Inspiracional)', () => {
    it('should ask for origin city before performing any recommendation search if origin is missing, then check direct flights once origin is given', async () => {
      const sessionId = 'session-rec-1';

      // Turno 1: Pide recomendaciones sin indicar origen -> debe preguntar origen antes de buscar
      const turn1 = await service.chat(
        'user-1',
        'Recomiéndame sitios baratos con playa para escaparme',
        sessionId,
      );

      expect(turn1.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn1.isComplete).toBe(false);
      expect(turn1.recommendations).toBeUndefined();
      expect(turn1.reply).toContain('ciudad o aeropuerto vas a salir');

      // Turno 2: El usuario indica la ciudad de origen -> comprueba vuelos directos y muestra las 5 opciones
      const turn2 = await service.chat('user-1', 'Desde Madrid', sessionId);

      expect(turn2.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn2.isComplete).toBe(false);
      expect(turn2.draftData?.originIata).toBe('MAD');
      expect(turn2.recommendations).toBeDefined();
      expect(turn2.recommendations).toHaveLength(5);
      expect(turn2.recommendations?.[0]).toEqual(
        expect.objectContaining({
          city: expect.any(String),
          iataCode: expect.any(String),
          country: expect.any(String),
          estimatedPriceEur: expect.any(Number),
          reason: expect.any(String),
          hasDirectFlights: expect.any(Boolean),
        }),
      );
      expect(turn2.reply).not.toContain('1.');
      expect(turn2.reply).toContain('¿Cuál de estos 5 destinos te gustaría elegir');
    });

    it('should verify which recommended destinations have direct flights vs layovers from origin before returning response', async () => {
      const sessionId = 'session-rec-direct-check';

      // Pide destinos de montaña indicando ya el origen en la frase
      const result = await service.chat(
        'user-1',
        'Recomiéndame sitios baratos de montaña saliendo desde Madrid',
        sessionId,
      );

      expect(result.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(result.recommendations).toHaveLength(5);

      const gva = result.recommendations?.find((r) => r.iataCode === 'GVA');
      const inn = result.recommendations?.find((r) => r.iataCode === 'INN');
      expect(gva?.hasDirectFlights).toBe(true);
      expect(inn?.hasDirectFlights).toBe(false);
      expect(result.reply).not.toContain('1.');
    });

    it('should transition from DESTINATION_RECOMMENDER to DEFINED_SEARCH across turns until confirmation', async () => {
      const sessionId = 'session-multi-turn-rec';

      // Turno 1: Pide recomendaciones de montaña (sin origen) -> pide origen
      const turn1 = await service.chat('user-1', 'Busco sitios baratos de montaña', sessionId);
      expect(turn1.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn1.recommendations).toBeUndefined();

      // Turno 2: Responde con la ciudad de origen -> devuelve las 5 recomendaciones verificando vuelos directos
      const turn2 = await service.chat('user-1', 'Madrid', sessionId);
      expect(turn2.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn2.recommendations).toHaveLength(5);
      expect(turn2.draftData?.originIata).toBe('MAD');

      // Turno 3: Elige uno de los destinos recomendados sin dar todos los datos -> no debe volver a devolver las recomendaciones
      const turn3Partial = await service.chat('user-1', 'Me quedo con Ginebra (GVA)', sessionId);
      expect(turn3Partial.activeSkill).toBe('DEFINED_SEARCH');
      expect(turn3Partial.recommendations).toBeUndefined();
      expect(turn3Partial.draftData?.destinationIata).toBe('GVA');

      // Turno 4: Da el resto de datos para completar la alerta
      const turn4Complete = await service.chat(
        'user-1',
        'En vuelo directo de viernes a domingo por menos de 90 euros entre 2026-12-01 y 2026-12-31',
        sessionId,
      );
      expect(turn4Complete.activeSkill).toBe('DEFINED_SEARCH');
      expect(turn4Complete.isComplete).toBe(true);
      expect(turn4Complete.awaitingConfirmation).toBe(true);
      expect(turn4Complete.recommendations).toBeUndefined();
      expect(turn4Complete.parsedData?.destinationIata).toBe('GVA');
      expect(turn4Complete.parsedData?.originIata).toBe('MAD');
      expect(turn4Complete.parsedData?.directOnly).toBe(true);

      // Turno 5: Confirma creación y encolado automático
      const turn5 = await service.chat('user-1', 'Sí, adelante', sessionId);
      expect(turn5.alertCreated).toBe(true);
      expect(mockScheduler.enqueueAlert).toHaveBeenCalledWith('created-alert-id-999');
    });

    it('should ask in DESTINATION_RECOMMENDER whether budget is per person or total when adults > 1 and budget is given', async () => {
      const sessionId = 'session-rec-budget-type';

      // Turno 1: Pide recomendaciones desde Madrid para 2 personas con 100 euros (sin especificar si es por persona o total)
      const turn1 = await service.chat(
        'user-1',
        'Recomiéndame sitios baratos con playa saliendo desde Madrid para 2 personas por menos de 100 euros',
        sessionId,
      );

      expect(turn1.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn1.recommendations).toBeUndefined();
      expect(turn1.reply).toContain('máximo por persona o máximo total');

      // Turno 2: Indica que es por persona -> aplica 200 EUR total (100 EUR/persona) y devuelve las 5 opciones
      const turn2 = await service.chat('user-1', 'Máximo por persona', sessionId);
      expect(turn2.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(turn2.recommendations).toHaveLength(5);
      expect(turn2.draftData?.maxPriceEur).toBe(200);
      expect(turn2.draftData?.budgetType).toBe('PER_PERSON');
      expect(turn2.reply).toContain('200 EUR total / 100 EUR por persona');
    });

    it('should never recommend the same airport as the user originIata', async () => {
      const sessionId = 'session-rec-no-same-origin';

      const result = await service.chat(
        'user-1',
        'Recomiéndame sitios baratos con playa saliendo desde Palma',
        sessionId,
      );

      expect(result.activeSkill).toBe('DESTINATION_RECOMMENDER');
      expect(result.draftData?.originIata).toBe('PMI');
      expect(result.recommendations).toHaveLength(5);
      expect(result.recommendations?.some((r) => r.iataCode === 'PMI')).toBe(false);
    });
  });

  describe('Validaciones de negocio (mismo origen/destino y mismo día)', () => {
    it('should reject searches with the same origin and destination by IATA code (MAD -> MAD)', async () => {
      const prompt =
        'Vuelos directos de MAD a MAD saliendo el lunes y volviendo el miercoles por menos de 100 euros entre el 2026-11-01 y el 2026-11-30';

      const result = await service.chat('user-1', prompt, 'session-same-iata');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/origen y.*destino.*no pueden ser el mismo/i);
      expect(result.draftData?.destinationIata).toBeUndefined();
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should reject searches with the same origin and destination by city name (Origen Madrid, Destino Madrid)', async () => {
      const prompt =
        'Vuelos directos de Madrid a Madrid saliendo el lunes y volviendo el miercoles por menos de 100 euros entre el 2026-11-01 y el 2026-11-30';

      const result = await service.chat('user-1', prompt, 'session-same-city');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/origen y.*destino.*no pueden ser el mismo/i);
      expect(result.draftData?.originIata).toBe('MAD');
      expect(result.draftData?.destinationIata).toBeUndefined();
    });

    it('should reject when the user picks the same airport as origin in a follow-up turn', async () => {
      const sessionId = 'session-same-airport-multiturn';

      await service.chat('user-1', 'Quiero vuelos directos desde Madrid', sessionId);
      const turn2 = await service.chat(
        'user-1',
        'Destino Madrid saliendo el lunes y volviendo el miercoles por 100 euros en noviembre de este año',
        sessionId,
      );

      expect(turn2.isComplete).toBe(false);
      expect(turn2.awaitingConfirmation).toBe(false);
      expect(turn2.reply).toMatch(/origen y.*destino.*no pueden ser el mismo/i);
      expect(turn2.draftData?.destinationIata).toBeUndefined();
    });

    it('should reject same-day departure and return using DD/MM/YYYY format (23/11/2026 y volver el 23/11/2026)', async () => {
      const prompt =
        'Vuelos directos de Madrid a Londres el 23/11/2026 y volver el 23/11/2026 saliendo el lunes y volviendo el lunes por menos de 100 euros';

      const result = await service.chat('user-1', prompt, 'session-same-day-ddmmyyyy');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/mismo d[ií]a/i);
      expect(result.draftData?.startDate).toBeUndefined();
      expect(result.draftData?.endDate).toBeUndefined();
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should reject same-day departure and return using ISO format (2026-11-23 al 2026-11-23)', async () => {
      const prompt =
        'Vuelos directos de MAD a LON saliendo el lunes y volviendo el lunes por menos de 100 euros entre el 2026-11-23 y el 2026-11-23';

      const result = await service.chat('user-1', prompt, 'session-same-day-iso');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/mismo d[ií]a/i);
    });

    it('should reject same-day departure and return using Spanish natural dates (23 de noviembre de 2026)', async () => {
      const prompt =
        'Vuelos directos de Madrid a Roma saliendo el 23 de noviembre de 2026 y volviendo el 23 de noviembre de 2026 por 90 euros';

      const result = await service.chat('user-1', prompt, 'session-same-day-natural');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/mismo d[ií]a/i);
      expect(result.draftData?.startDate).toBeUndefined();
      expect(result.draftData?.endDate).toBeUndefined();
    });

    it('should reject both same airport AND same day together and allow recovery once corrected', async () => {
      const sessionId = 'session-both-invalid-recover';

      const turn1 = await service.chat(
        'user-1',
        'Vuelos directos de Madrid a Madrid el 23/11/2026 y volver el 23/11/2026 saliendo el lunes y volviendo el miercoles por menos de 100 euros',
        sessionId,
      );

      expect(turn1.isComplete).toBe(false);
      expect(turn1.awaitingConfirmation).toBe(false);
      expect(turn1.reply).toMatch(/origen y.*destino.*no pueden ser el mismo/i);
      expect(turn1.reply).toMatch(/mismo d[ií]a/i);

      // Turno 2: el usuario corrige el destino y las fechas
      const turn2 = await service.chat(
        'user-1',
        'Perdón, destino Londres del 23/11/2026 al 30/11/2026',
        sessionId,
      );

      expect(turn2.isComplete).toBe(true);
      expect(turn2.awaitingConfirmation).toBe(true);
      expect(turn2.parsedData?.originIata).toBe('MAD');
      expect(turn2.parsedData?.destinationIata).toBe('LON');
      expect(turn2.parsedData?.startDate).toBe('2026-11-23');
      expect(turn2.parsedData?.endDate).toBe('2026-11-30');
    });

    it('should reject when the date range does not contain any valid departure-return combination', async () => {
      const prompt =
        'Vuelos directos de MAD a LON saliendo el lunes y volviendo el lunes del 23/11/2026 al 24/11/2026 por menos de 100 euros';

      const result = await service.chat('user-1', prompt, 'session-no-valid-tuple');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/combinaci[oó]n v[aá]lida/i);
    });

    it('should reject "Origen Madrid, Destino Madrid" phrasing and natural "mismo día" phrasing', async () => {
      const prompt =
        'Origen Madrid, Destino Madrid, vuelo directo para ir y volver el mismo día por menos de 100 euros';

      const result = await service.chat('user-1', prompt, 'session-natural-both-invalid');

      expect(result.isComplete).toBe(false);
      expect(result.awaitingConfirmation).toBe(false);
      expect(result.reply).toMatch(/origen y.*destino.*no pueden ser el mismo/i);
      expect(result.reply).toMatch(/mismo d[ií]a/i);
    });
  });
});
