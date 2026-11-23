import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AlertSchedulerService } from './alert-scheduler.service';
import { IgnavAdapter } from '../../infrastructure/adapters/ignav.adapter';
import {
  extractUtcDateKey,
  validateAlertSearchRules,
} from '../../domain/dtos/create-alert.dto';

export type AgentSkill = 'DEFINED_SEARCH' | 'DESTINATION_RECOMMENDER';

export interface DestinationRecommendation {
  city: string;
  iataCode: string;
  country: string;
  estimatedPriceEur: number;
  reason: string;
  hasDirectFlights?: boolean;
}

export type BudgetType = 'PER_PERSON' | 'TOTAL';

export interface ParsedAlertDraft {
  originIata?: string;
  destinationIata?: string;
  departureDay?: number;
  returnDay?: number;
  adults?: number;
  directOnly?: boolean;
  maxPriceEur?: number | null;
  rawMaxPriceEur?: number;
  budgetType?: BudgetType;
  startDate?: string;
  endDate?: string;
}

export interface AgentParseResult {
  sessionId: string;
  activeSkill: AgentSkill;
  reply: string;
  isComplete: boolean;
  awaitingConfirmation: boolean;
  alertCreated?: boolean;
  createdAlertId?: string;
  clarificationMessage?: string;
  recommendations?: DestinationRecommendation[];
  parsedData?: {
    originIata: string;
    destinationIata: string;
    departureDay: number;
    returnDay: number;
    adults: number;
    directOnly: boolean;
    maxPriceEur: number | null;
    startDate: string;
    endDate: string;
  };
  draftData?: ParsedAlertDraft;
}

interface SessionState {
  activeSkill: AgentSkill;
  draft: ParsedAlertDraft;
  recommendations?: DestinationRecommendation[];
  pendingRecommendationPrompt?: string;
  awaitingConfirmation: boolean;
  history: { role: 'user' | 'assistant'; text: string }[];
}

const DAY_NAMES: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 7,
};

const DAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const MONTH_NAMES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const CITY_TO_IATA: Record<string, string> = {
  madrid: 'MAD',
  barcelona: 'BCN',
  tokio: 'HND',
  tokyo: 'HND',
  londres: 'LON',
  paris: 'PAR',
  parís: 'PAR',
  roma: 'ROM',
  amsterdam: 'AMS',
  ámsterdam: 'AMS',
  'nueva york': 'JFK',
  dubai: 'DXB',
  dubái: 'DXB',
  palma: 'PMI',
  mallorca: 'PMI',
  tenerife: 'TFS',
  faro: 'FAO',
  malaga: 'AGP',
  málaga: 'AGP',
  alicante: 'ALC',
  ginebra: 'GVA',
  zurich: 'ZRH',
  zúrich: 'ZRH',
  milan: 'BGY',
  milán: 'BGY',
  innsbruck: 'INN',
  turin: 'TRN',
  turín: 'TRN',
  lisboa: 'LIS',
  oporto: 'OPO',
  berlin: 'BER',
  berlín: 'BER',
  bruselas: 'BRU',
  viena: 'VIE',
  praga: 'PRG',
  budapest: 'BUD',
  atenas: 'ATH',
  dublin: 'DUB',
  dublín: 'DUB',
  edimburgo: 'EDI',
  venecia: 'VCE',
  napoles: 'NAP',
  nápoles: 'NAP',
  florencia: 'FLR',
  sevilla: 'SVQ',
  valencia: 'VLC',
  bilbao: 'BIO',
  ibiza: 'IBZ',
  lanzarote: 'ACE',
  zaragoza: 'ZAZ',
  santiago: 'SCQ',
  asturias: 'OVD',
  oviedo: 'OVD',
  santander: 'SDR',
  'gran canaria': 'LPA',
  'las palmas': 'LPA',
  fuerteventura: 'FUE',
  menorca: 'MAH',
  granada: 'GRX',
  jerez: 'XRY',
  murcia: 'RMU',
  vigo: 'VGO',
  coruña: 'LCG',
  'a coruña': 'LCG',
};

const BEACH_RECOMMENDATIONS: DestinationRecommendation[] = [
  {
    city: 'Palma de Mallorca',
    iataCode: 'PMI',
    country: 'España',
    estimatedPriceEur: 35,
    reason: 'Calas de agua cristalina y tarifas ultra-económicas todo el año.',
  },
  {
    city: 'Faro (Algarve)',
    iataCode: 'FAO',
    country: 'Portugal',
    estimatedPriceEur: 45,
    reason: 'Acantilados espectaculares, playas tranquilas y gastronomía muy asequible.',
  },
  {
    city: 'Tenerife Sur',
    iataCode: 'TFS',
    country: 'España',
    estimatedPriceEur: 65,
    reason: 'Clima cálido garantizado incluso en otoño e invierno con playas volcánicas.',
  },
  {
    city: 'Málaga (Costa del Sol)',
    iataCode: 'AGP',
    country: 'España',
    estimatedPriceEur: 40,
    reason: 'Más de 300 días de sol al año, ambiente cultural y precios muy bajos.',
  },
  {
    city: 'Alicante (Costa Blanca)',
    iataCode: 'ALC',
    country: 'España',
    estimatedPriceEur: 38,
    reason: 'Playas de arena blanca y conexiones frecuentes low-cost.',
  },
];

const MOUNTAIN_RECOMMENDATIONS: DestinationRecommendation[] = [
  {
    city: 'Ginebra (Alpes)',
    iataCode: 'GVA',
    country: 'Suiza / Francia',
    estimatedPriceEur: 55,
    reason: 'Puerta de entrada directa a Chamonix y los Alpes con mucha oferta low-cost.',
  },
  {
    city: 'Milán - Bérgamo (Dolomitas)',
    iataCode: 'BGY',
    country: 'Italia',
    estimatedPriceEur: 39,
    reason: 'Uno de los aeropuertos más baratos de Europa a un paso de los Alpes italianos y el Lago Como.',
  },
  {
    city: 'Innsbruck (Tirol)',
    iataCode: 'INN',
    country: 'Austria',
    estimatedPriceEur: 85,
    reason: 'Rodeada de cumbres alpinas espectaculares para senderismo y nieve.',
  },
  {
    city: 'Turín (Piamonte)',
    iataCode: 'TRN',
    country: 'Italia',
    estimatedPriceEur: 48,
    reason: 'Acceso inmediato a los Alpes del Piamonte con precios de alojamiento muy económicos.',
  },
  {
    city: 'Zúrich',
    iataCode: 'ZRH',
    country: 'Suiza',
    estimatedPriceEur: 75,
    reason: 'Conexiones rápidas en tren a las principales rutas alpinas suizas.',
  },
];

const ITALY_RECOMMENDATIONS: DestinationRecommendation[] = [
  {
    city: 'Roma',
    iataCode: 'ROM',
    country: 'Italia',
    estimatedPriceEur: 45,
    reason: 'Ideal para 3 días en invierno: Coliseo, Vaticano y Trastevere sin colas ni calor y con vuelos muy baratos en enero.',
  },
  {
    city: 'Milán - Bérgamo',
    iataCode: 'BGY',
    country: 'Italia',
    estimatedPriceEur: 32,
    reason: 'El aeropuerto con más frecuencias low-cost de Italia; perfecto para una escapada de 3 días combinando Milán y Bérgamo Alta.',
  },
  {
    city: 'Venecia',
    iataCode: 'VCE',
    country: 'Italia',
    estimatedPriceEur: 48,
    reason: 'Recorrer sus canales y plazas en 3 días durante enero es mucho más económico y tranquilo que en temporada alta.',
  },
  {
    city: 'Nápoles',
    iataCode: 'NAP',
    country: 'Italia',
    estimatedPriceEur: 42,
    reason: 'Clima suave en enero, gastronomía inigualable y excursión rápida a Pompeya en una escapada de 3 días.',
  },
  {
    city: 'Turín',
    iataCode: 'TRN',
    country: 'Italia',
    estimatedPriceEur: 39,
    reason: 'Cafés históricos, museos increíbles y vistas a los Alpes nevados a precios muy bajos en enero.',
  },
];

const GENERAL_CHEAP_RECOMMENDATIONS: DestinationRecommendation[] = [
  {
    city: 'Oporto',
    iataCode: 'OPO',
    country: 'Portugal',
    estimatedPriceEur: 32,
    reason: 'Escapada económica por excelencia, ideal para un par de días.',
  },
  {
    city: 'Roma',
    iataCode: 'ROM',
    country: 'Italia',
    estimatedPriceEur: 49,
    reason: 'Historia, gastronomía y gran volumen de aerolíneas low-cost.',
  },
  {
    city: 'Londres',
    iataCode: 'LON',
    country: 'Reino Unido',
    estimatedPriceEur: 45,
    reason: 'Múltiples aeropuertos con ofertas constantes entre semana.',
  },
  {
    city: 'París',
    iataCode: 'PAR',
    country: 'Francia',
    estimatedPriceEur: 55,
    reason: 'Frecuencias diarias económicas hacia Beauvais, Orly y CDG.',
  },
  {
    city: 'Lisboa',
    iataCode: 'LIS',
    country: 'Portugal',
    estimatedPriceEur: 38,
    reason: 'Cercanía, miradores y excelente relación calidad-precio.',
  },
];

const FALLBACK_RECOMMENDATIONS_POOL: DestinationRecommendation[] = [
  {
    city: 'Ibiza',
    iataCode: 'IBZ',
    country: 'España',
    estimatedPriceEur: 42,
    reason: 'Calas turquesas, puestas de sol y conexiones frecuentes a buen precio.',
  },
  {
    city: 'Gran Canaria',
    iataCode: 'LPA',
    country: 'España',
    estimatedPriceEur: 58,
    reason: 'Playas de arena dorada y clima primaveral durante todo el año.',
  },
  {
    city: 'Praga',
    iataCode: 'PRG',
    country: 'Chequia',
    estimatedPriceEur: 49,
    reason: 'Centro histórico de cuento con vuelos económicos y precios locales muy contenidos.',
  },
  {
    city: 'Atenas',
    iataCode: 'ATH',
    country: 'Grecia',
    estimatedPriceEur: 62,
    reason: 'Historia milenaria, gastronomía mediterránea y escapadas cercanas a la costa.',
  },
  {
    city: 'Dublín',
    iataCode: 'DUB',
    country: 'Irlanda',
    estimatedPriceEur: 44,
    reason: 'Ambiente vibrante, cultura y gran frecuencia de vuelos low-cost.',
  },
  ...GENERAL_CHEAP_RECOMMENDATIONS,
];

@Injectable()
export class AlertParserAgentService {
  private readonly logger = new Logger(AlertParserAgentService.name);
  private readonly sessions = new Map<string, SessionState>();
  private readonly skillsContent: Record<AgentSkill, string>;
  private readonly ignavAdapter: IgnavAdapter;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly alertScheduler?: AlertSchedulerService,
    @Optional() ignavAdapter?: IgnavAdapter,
  ) {
    this.ignavAdapter = ignavAdapter || new IgnavAdapter();
    this.skillsContent = {
      DEFINED_SEARCH: this.loadSkillFile('defined-search'),
      DESTINATION_RECOMMENDER: this.loadSkillFile('destination-recommender'),
    };
  }

  getLoadedSkills(): Record<AgentSkill, string> {
    return this.skillsContent;
  }

  private loadSkillFile(folderName: string): string {
    const candidates = [
      path.join(__dirname, '..', 'skills', folderName, 'SKILL.md'),
      path.join(process.cwd(), 'src', 'application', 'skills', folderName, 'SKILL.md'),
      path.join(process.cwd(), 'apps', 'api', 'src', 'application', 'skills', folderName, 'SKILL.md'),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    }
    return '';
  }

  async parsePrompt(prompt: string, userId = 'anonymous', sessionId = 'default-session'): Promise<AgentParseResult> {
    return this.chat(userId, prompt, sessionId);
  }

  async chat(userId: string, prompt: string, sessionId = `session-${userId}`): Promise<AgentParseResult> {
    const state: SessionState = this.sessions.get(sessionId) || {
      activeSkill: 'DEFINED_SEARCH',
      draft: { adults: 1 },
      awaitingConfirmation: false,
      history: [],
    };

    state.history.push({ role: 'user', text: prompt });

    // 1. Si estábamos esperando confirmación del usuario para lanzar la alerta
    if (state.awaitingConfirmation && this.isDraftComplete(state.draft)) {
      if (this.isAffirmative(prompt)) {
        const fullData = this.toCompleteData(state.draft);
        const validationErrors = validateAlertSearchRules(fullData);
        if (validationErrors.length > 0) {
          state.awaitingConfirmation = false;
          this.sanitizeAndValidateDraft(state.draft, validationErrors);
          const errorReply = `⚠️ ${validationErrors.join(' ')} Por favor, indícame los datos corregidos para continuar.`;
          state.history.push({ role: 'assistant', text: errorReply });
          this.sessions.set(sessionId, state);
          return {
            sessionId,
            activeSkill: 'DEFINED_SEARCH',
            reply: errorReply,
            clarificationMessage: errorReply,
            isComplete: false,
            awaitingConfirmation: false,
            draftData: state.draft,
          };
        }

        let createdAlertId: string | undefined;

        if (this.prisma) {
          let created: any;
          try {
            created = await this.prisma.alert.create({
              data: {
                userId,
                originIata: fullData.originIata,
                destinationIata: fullData.destinationIata,
                departureDay: fullData.departureDay,
                returnDay: fullData.returnDay,
                adults: fullData.adults,
                directOnly: fullData.directOnly,
                maxPriceEur: fullData.maxPriceEur,
                startDate: new Date(fullData.startDate),
                endDate: new Date(fullData.endDate),
              } as any,
            });
          } catch {
            created = await this.prisma.alert.create({
              data: {
                userId,
                originIata: fullData.originIata,
                destinationIata: fullData.destinationIata,
                departureDay: fullData.departureDay,
                returnDay: fullData.returnDay,
                adults: fullData.adults,
                maxPriceEur: fullData.maxPriceEur,
                startDate: new Date(fullData.startDate),
                endDate: new Date(fullData.endDate),
              } as any,
            });
          }
          createdAlertId = created.id;

          if ((this.prisma as any).$executeRawUnsafe) {
            try {
              await (this.prisma as any).$executeRawUnsafe(
                `UPDATE "Alert" SET "directOnly" = $1 WHERE "id" = $2`,
                fullData.directOnly,
                created.id,
              );
            } catch {
              // ignore
            }
          }

          if (this.alertScheduler) {
            this.alertScheduler.markInitialSearchStarted?.(created.id);
            await this.alertScheduler.enqueueAlert(created.id);
          }
        }

        // Limpiar sesión tras crear la alerta
        this.sessions.delete(sessionId);

        const depName = this.getDayLabel(fullData.departureDay);
        const retName = this.getDayLabel(fullData.returnDay);
        const flightTypeLabel = fullData.directOnly ? 'solo vuelos directos' : 'con escalas permitidas';
        const budgetSummary =
          fullData.maxPriceEur != null ? `máx. ${fullData.maxPriceEur} EUR` : 'sin límite de precio';
        const reply = `🚀 ¡Perfecto! He creado y encolado tu alerta de ${fullData.originIata} a ${fullData.destinationIata} (salida los ${depName} y regreso los ${retName}, ${flightTypeLabel}, ${budgetSummary} para ${fullData.adults} pasajero(s)). En cuanto encontremos vuelos te avisaremos por Telegram.`;
        return {
          sessionId,
          activeSkill: 'DEFINED_SEARCH',
          reply,
          isComplete: true,
          awaitingConfirmation: false,
          alertCreated: true,
          createdAlertId,
          parsedData: fullData,
        };
      }

      if (this.isNegative(prompt)) {
        state.awaitingConfirmation = false;
        const reply = 'Entendido, no he lanzado la alerta todavía. Dime qué dato quieres modificar (destino, fechas, días de la semana, pasajeros, presupuesto o si prefieres vuelo directo o con escalas).';
        state.history.push({ role: 'assistant', text: reply });
        this.sessions.set(sessionId, state);
        return {
          sessionId,
          activeSkill: 'DEFINED_SEARCH',
          reply,
          isComplete: false,
          awaitingConfirmation: false,
          draftData: state.draft,
        };
      }
    }

    // 2. Decidir si usar Mock o Gemini Real
    const useMock = process.env.USE_AGENT_MOCK !== 'false';
    if (process.env.USE_AGENT_MOCK === 'true') {
      this.logger.log(`[TEST MODE] Procesando consulta del agente con motor local (sesión: ${sessionId})`);
    }
    const result = useMock
      ? await this.processWithSkillsEngine(prompt, state, sessionId)
      : await this.processWithGeminiLlm(prompt, state, sessionId);

    state.history.push({ role: 'assistant', text: result.reply });
    this.sessions.set(sessionId, state);
    return result;
  }

  private async processWithSkillsEngine(
    prompt: string,
    state: SessionState,
    sessionId: string,
  ): Promise<AgentParseResult> {
    const lower = prompt.toLowerCase();

    // Detectar si activa la Skill 2: DESTINATION_RECOMMENDER
    const wantsRecommendation =
      (lower.includes('recomienda') ||
        lower.includes('recomendacion') ||
        lower.includes('sitios') ||
        lower.includes('destinos') ||
        lower.includes('donde ir') ||
        lower.includes('dónde ir') ||
        lower.includes('playa') ||
        lower.includes('montaña') ||
        lower.includes('montana')) &&
      !this.hasExplicitDestinationChoice(prompt, state.recommendations);

    const isCompletingPendingRecommendation =
      Boolean(state.pendingRecommendationPrompt) &&
      !this.hasExplicitRouteInPrompt(prompt) &&
      !this.hasExplicitDestinationChoice(prompt, state.recommendations);

    if (wantsRecommendation || isCompletingPendingRecommendation) {
      state.activeSkill = 'DESTINATION_RECOMMENDER';
      let recValidationErrors: string[] = [];

      if (wantsRecommendation) {
        state.pendingRecommendationPrompt = prompt;
        recValidationErrors = this.extractEntitiesIntoDraft(prompt, state, true);
      } else {
        this.extractOriginFromReply(prompt, state);
        recValidationErrors = this.extractEntitiesIntoDraft(prompt, state, true);
        if (!state.draft.originIata) {
          await this.resolveOriginFromDatabase(prompt, state);
        }
        if (!state.draft.originIata) {
          state.pendingRecommendationPrompt = `${state.pendingRecommendationPrompt} ${prompt}`;
        }
      }
      recValidationErrors = this.sanitizeAndValidateDraft(state.draft, recValidationErrors);

      // Regla obligatoria: pedir la ciudad de origen (y aclarar presupuesto por persona vs total si hay >1 pasajero) antes de buscar
      if (!state.draft.originIata && this.needsBudgetTypeClarification(state.draft)) {
        state.recommendations = undefined;
        const rawBudget = state.draft.rawMaxPriceEur ?? state.draft.maxPriceEur;
        const warningPrefix =
          recValidationErrors.length > 0 ? `⚠️ ${recValidationErrors.join(' ')}\n\n` : '';
        const askBothReply = `${warningPrefix}Antes de realizar la búsqueda y recomendarte destinos, ¿desde qué ciudad o aeropuerto vas a salir? Además, al ser ${state.draft.adults} pasajeros, ¿el presupuesto máximo de ${rawBudget} EUR es máximo por persona o máximo total?`;
        return {
          sessionId,
          activeSkill: 'DESTINATION_RECOMMENDER',
          reply: askBothReply,
          clarificationMessage: askBothReply,
          isComplete: false,
          awaitingConfirmation: false,
          draftData: state.draft,
        };
      }

      if (!state.draft.originIata) {
        state.recommendations = undefined;
        const warningPrefix =
          recValidationErrors.length > 0 ? `⚠️ ${recValidationErrors.join(' ')}\n\n` : '';
        const askOriginReply = `${warningPrefix}Antes de realizar la búsqueda y recomendarte destinos (comprobando si tienen vuelos directos o con escalas), ¿desde qué ciudad o aeropuerto vas a salir?`;
        return {
          sessionId,
          activeSkill: 'DESTINATION_RECOMMENDER',
          reply: askOriginReply,
          clarificationMessage: askOriginReply,
          isComplete: false,
          awaitingConfirmation: false,
          draftData: state.draft,
        };
      }

      if (this.needsBudgetTypeClarification(state.draft)) {
        state.recommendations = undefined;
        if (!state.pendingRecommendationPrompt) {
          state.pendingRecommendationPrompt = prompt;
        }
        const rawBudget = state.draft.rawMaxPriceEur ?? state.draft.maxPriceEur;
        const warningPrefix =
          recValidationErrors.length > 0 ? `⚠️ ${recValidationErrors.join(' ')}\n\n` : '';
        const askBudgetTypeReply = `${warningPrefix}Antes de realizar la búsqueda para los ${state.draft.adults} pasajeros, ¿el presupuesto máximo de ${rawBudget} EUR que has indicado es máximo por persona o máximo total?`;
        return {
          sessionId,
          activeSkill: 'DESTINATION_RECOMMENDER',
          reply: askBudgetTypeReply,
          clarificationMessage: askBudgetTypeReply,
          isComplete: false,
          awaitingConfirmation: false,
          draftData: state.draft,
        };
      }

      const effectiveThemePrompt = (state.pendingRecommendationPrompt || prompt).toLowerCase();
      state.pendingRecommendationPrompt = undefined;

      let baseRecs = GENERAL_CHEAP_RECOMMENDATIONS;
      let themeName = 'económicos en Europa';

      if (effectiveThemePrompt.includes('italia') || effectiveThemePrompt.includes('italiano')) {
        baseRecs = ITALY_RECOMMENDATIONS;
        themeName = 'en Italia';
      } else if (
        effectiveThemePrompt.includes('playa') ||
        effectiveThemePrompt.includes('costa') ||
        effectiveThemePrompt.includes('sol')
      ) {
        baseRecs = BEACH_RECOMMENDATIONS;
        themeName = 'baratos con playa';
      } else if (
        effectiveThemePrompt.includes('montaña') ||
        effectiveThemePrompt.includes('montana') ||
        effectiveThemePrompt.includes('nieve') ||
        effectiveThemePrompt.includes('alpes')
      ) {
        baseRecs = MOUNTAIN_RECOMMENDATIONS;
        themeName = 'baratos de montaña';
      }

      // Antes de mostrar las respuestas al usuario, excluir el aeropuerto de origen y comprobar vuelos directos
      const originIata = state.draft.originIata;
      const filteredRecs = this.excludeOriginFromRecommendations(originIata, baseRecs);
      const verifiedRecs = await this.verifyDirectFlightsForRecommendations(
        originIata,
        filteredRecs,
        state.draft,
      );
      state.recommendations = verifiedRecs;

      const adultsCount = state.draft.adults ?? 1;
      const missingAfterRec = this.getMissingFieldsAfterRecommendation(state.draft);
      const budgetContext =
        adultsCount > 1 && state.draft.maxPriceEur != null
          ? ` (presupuesto aplicado: máx. ${state.draft.maxPriceEur} EUR total / ${Number((state.draft.maxPriceEur / adultsCount).toFixed(2))} EUR por persona)`
          : '';
      const warningLine =
        recValidationErrors.length > 0 ? [`⚠️ ${recValidationErrors.join(' ')}`, ''] : [];

      const reply = [
        ...warningLine,
        `🌟 Aquí tienes 5 recomendaciones de destinos ${themeName} saliendo desde ${originIata}${budgetContext} (he comprobado cuáles disponen de vuelos directos desde tu origen).`,
        '',
        `¿Cuál de estos 5 destinos te gustaría elegir? Cuando elijas uno, dime también ${missingAfterRec}.`,
      ].join('\n');

      return {
        sessionId,
        activeSkill: 'DESTINATION_RECOMMENDER',
        reply,
        isComplete: false,
        awaitingConfirmation: false,
        recommendations: verifiedRecs,
        draftData: state.draft,
      };
    }

    // Skill 1: DEFINED_SEARCH (o transición desde recomendador cuando elige un destino)
    state.activeSkill = 'DEFINED_SEARCH';
    let validationErrors = this.extractEntitiesIntoDraft(prompt, state);
    validationErrors = this.sanitizeAndValidateDraft(state.draft, validationErrors);

    if (state.draft.destinationIata) {
      state.recommendations = undefined;
      state.pendingRecommendationPrompt = undefined;
    }

    if (validationErrors.length > 0) {
      state.awaitingConfirmation = false;
      const missing = this.getMissingFieldsDescription(state.draft);
      const clarificationMessage = missing
        ? `⚠️ ${validationErrors.join(' ')} Para configurar tu alerta todavía necesito que me indiques: ${missing}.`
        : `⚠️ ${validationErrors.join(' ')} Por favor, corrige esos datos para continuar.`;

      return {
        sessionId,
        activeSkill: 'DEFINED_SEARCH',
        reply: clarificationMessage,
        clarificationMessage,
        isComplete: false,
        awaitingConfirmation: false,
        draftData: state.draft,
      };
    }

    if (this.isDraftComplete(state.draft)) {
      state.awaitingConfirmation = true;
      const fullData = this.toCompleteData(state.draft);
      const depName = this.getDayLabel(fullData.departureDay);
      const retName = this.getDayLabel(fullData.returnDay);
      const flightTypeText = fullData.directOnly
        ? 'Solo vuelos directos'
        : 'Con escalas permitidas';
      const budgetText =
        fullData.maxPriceEur == null
          ? 'Sin límite de precio'
          : fullData.adults > 1
            ? `${fullData.maxPriceEur} EUR en total (${Number((fullData.maxPriceEur / fullData.adults).toFixed(2))} EUR por persona)`
            : `${fullData.maxPriceEur} EUR`;
      const reply = [
        `✅ Ya tengo todos los datos para tu alerta:`,
        `- Ruta: ${fullData.originIata} ➔ ${fullData.destinationIata}`,
        `- Días: Salida los ${depName} / Regreso los ${retName}`,
        `- Tipo de vuelo: ${flightTypeText}`,
        `- Pasajeros: ${fullData.adults}`,
        `- Presupuesto máx.: ${budgetText}`,
        `- Rango: ${fullData.startDate} al ${fullData.endDate}`,
        '',
        `¿Deseas que lance y active esta alerta ahora mismo? (Responde "Sí" para encolarla automáticamente).`,
      ].join('\n');

      return {
        sessionId,
        activeSkill: 'DEFINED_SEARCH',
        reply,
        isComplete: true,
        awaitingConfirmation: true,
        parsedData: fullData,
      };
    }

    // Si faltan datos, preguntar específicamente por los que faltan
    const missing = this.getMissingFieldsDescription(state.draft);
    const clarificationMessage = `Para configurar tu alerta todavía necesito que me indiques: ${missing}.`;

    return {
      sessionId,
      activeSkill: 'DEFINED_SEARCH',
      reply: clarificationMessage,
      clarificationMessage,
      isComplete: false,
      awaitingConfirmation: false,
      draftData: state.draft,
    };
  }

  private async processWithGeminiLlm(
    prompt: string,
    state: SessionState,
    sessionId: string,
  ): Promise<AgentParseResult> {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey || apiKey === 'tu_gemini_api_key_aqui') {
      this.logger.warn('GOOGLE_GENAI_API_KEY no configurada, usando motor local de Skills como respaldo.');
      return this.processWithSkillsEngine(prompt, state, sessionId);
    }

    const lower = prompt.toLowerCase();
    const wantsRecommendation =
      (lower.includes('recomienda') ||
        lower.includes('recomendacion') ||
        lower.includes('sitios') ||
        lower.includes('destinos') ||
        lower.includes('donde ir') ||
        lower.includes('dónde ir') ||
        lower.includes('playa') ||
        lower.includes('montaña') ||
        lower.includes('montana')) &&
      !this.hasExplicitDestinationChoice(prompt, state.recommendations);

    const isCompletingPendingRecommendation =
      Boolean(state.pendingRecommendationPrompt) &&
      !this.hasExplicitRouteInPrompt(prompt) &&
      !this.hasExplicitDestinationChoice(prompt, state.recommendations);

    if (wantsRecommendation) {
      state.pendingRecommendationPrompt = prompt;
      this.extractEntitiesIntoDraft(prompt, state, true);
    } else if (isCompletingPendingRecommendation) {
      this.extractOriginFromReply(prompt, state);
      this.extractEntitiesIntoDraft(prompt, state, true);
    }

    try {
      const currentYear = new Date().getUTCFullYear();
      const pendingContext = state.pendingRecommendationPrompt
        ? `\nSolicitud previa de recomendación pendiente: "${state.pendingRecommendationPrompt}"`
        : '';

      const systemPrompt = `Eres Vera, una asistente experta en vuelos que opera bajo las siguientes SKILL.md cargadas dinámicamente.
Fecha actual UTC: ${new Date().toISOString().split('T')[0]} (año actual: ${currentYear}).

=== SKILL 1: DEFINED_SEARCH ===
${this.skillsContent.DEFINED_SEARCH}

=== SKILL 2: DESTINATION_RECOMMENDER ===
${this.skillsContent.DESTINATION_RECOMMENDER}

Estado actual del borrador de la sesión: ${JSON.stringify(state.draft)}${pendingContext}
IMPORTANTE:
- En DESTINATION_RECOMMENDER, si "originIata" NO está definido ni en el borrador ni en el mensaje actual del usuario, NO devuelvas recomendaciones ("recommendations": null) y pregúntale primero desde qué ciudad o aeropuerto vas a salir.
- NUNCA permitas que "originIata" y "destinationIata" sean el mismo aeropuerto (ej. Madrid a Madrid / MAD a MAD), ni recomiendes el mismo aeropuerto de origen. Si ocurre, deja "destinationIata": null y explica claramente que el origen y el destino no pueden ser el mismo aeropuerto.
- NUNCA permitas búsquedas de ida y vuelta para el mismo día ("startDate" === "endDate", ej. 23/11/2026 y volver el 23/11/2026) ni "startDate" > "endDate". Si ocurre, deja "startDate": null y "endDate": null y explica claramente que no se permiten búsquedas en el mismo día.
- El presupuesto máximo ("maxPriceEur") es OPCIONAL (null si el usuario no fija un tope de precio). Tanto en DESTINATION_RECOMMENDER como en DEFINED_SEARCH, si hay más de 1 pasajero ("adults" > 1) y el usuario SÍ ha indicado un presupuesto máximo ("maxPriceEur"), pero no se ha aclarado si es por persona o total ("budgetType" no definido), DEBES preguntar explícitamente si ese presupuesto es **máximo por persona o máximo total** ("budgetType": "PER_PERSON" | "TOTAL" | null).
- En el campo "reply" dirigido al usuario NUNCA muestres los días de la semana como números (1 al 7); usa siempre sus nombres en español (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo).
- En "draft", "departureDay" y "returnDay" deben ser enteros del 1 (Lunes) al 7 (Domingo), "startDate"/"endDate" cadenas "YYYY-MM-DD", y "directOnly" booleano (true = solo vuelo directo / sin escalas, false = con escalas permitidas, o null si aún no lo ha indicado).
- Si "directOnly" aún no está definido en el borrador ni en el mensaje actual, DEBES preguntarle explícitamente al usuario si prefiere **vuelo directo o con escalas**.
Responde EXCLUSIVAMENTE un objeto JSON válido con la estructura:
{ "activeSkill": "DEFINED_SEARCH" | "DESTINATION_RECOMMENDER", "draft": {...}, "recommendations": [...] | null, "reply": "..." }`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nMensaje del usuario: "${prompt}"` }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      };

      const candidateModels = [
        process.env.GEMINI_MODEL,
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
      ].filter(Boolean) as string[];

      let response: any = null;
      let lastErrorMsg = '';

      for (const modelName of candidateModels) {
        try {
          response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            payload,
            { timeout: 12000 },
          );
          break;
        } catch (err: any) {
          lastErrorMsg = err?.response?.data?.error?.message || err?.message || '';
        }
      }

      if (!response) {
        throw new Error(lastErrorMsg || 'No se pudo conectar con ningún modelo de Gemini');
      }

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const choseRecommendedDestination = this.hasExplicitDestinationChoice(
          prompt,
          state.recommendations,
        );
        state.activeSkill = choseRecommendedDestination
          ? 'DEFINED_SEARCH'
          : wantsRecommendation || isCompletingPendingRecommendation
            ? 'DESTINATION_RECOMMENDER'
            : parsed.activeSkill || 'DEFINED_SEARCH';

        const prevRawPrice = state.draft.rawMaxPriceEur;
        // Combinar tanto la extracción determinista local (fechas de meses, duración, ciudades) como la de Gemini
        let validationErrors = this.extractEntitiesIntoDraft(
          prompt,
          state,
          state.activeSkill === 'DESTINATION_RECOMMENDER',
        );
        const hasNewPriceInPrompt = /(\d+(?:[.,]\d+)?)\s*(?:euros|eur|€)/i.test(prompt);

        if (parsed.draft && typeof parsed.draft === 'object') {
          for (const [k, v] of Object.entries(parsed.draft)) {
            if (v !== null && v !== undefined && v !== '') {
              if (k === 'maxPriceEur' && !hasNewPriceInPrompt && prevRawPrice !== undefined) {
                continue;
              }
              (state.draft as any)[k] = v;
            }
          }
          if (hasNewPriceInPrompt && state.draft.rawMaxPriceEur === undefined && state.draft.maxPriceEur != null) {
            state.draft.rawMaxPriceEur = Number(state.draft.maxPriceEur);
          }
          this.normalizeDraftFields(state.draft);
        }

        validationErrors = this.sanitizeAndValidateDraft(state.draft, validationErrors);

        // Si ya eligió un destino o está en DEFINED_SEARCH, limpiar recomendaciones previas para no volver a mostrarlas
        if (state.activeSkill === 'DEFINED_SEARCH' || state.draft.destinationIata) {
          state.activeSkill = 'DEFINED_SEARCH';
          state.recommendations = undefined;
          state.pendingRecommendationPrompt = undefined;
        }

        // Regla obligatoria en DESTINATION_RECOMMENDER: pedir origen (y aclarar presupuesto por persona vs total si hay >1 pasajero) antes de buscar
        if (
          state.activeSkill === 'DESTINATION_RECOMMENDER' &&
          !state.draft.originIata &&
          this.needsBudgetTypeClarification(state.draft)
        ) {
          state.recommendations = undefined;
          if (!state.pendingRecommendationPrompt) {
            state.pendingRecommendationPrompt = prompt;
          }
          const rawBudget = state.draft.rawMaxPriceEur ?? state.draft.maxPriceEur;
          const askBothReply = `Antes de realizar la búsqueda y recomendarte destinos, ¿desde qué ciudad o aeropuerto vas a salir? Además, al ser ${state.draft.adults} pasajeros, ¿el presupuesto máximo de ${rawBudget} EUR es máximo por persona o máximo total?`;
          return {
            sessionId,
            activeSkill: 'DESTINATION_RECOMMENDER',
            reply: askBothReply,
            clarificationMessage: askBothReply,
            isComplete: false,
            awaitingConfirmation: false,
            draftData: state.draft,
          };
        }

        if (state.activeSkill === 'DESTINATION_RECOMMENDER' && !state.draft.originIata) {
          state.recommendations = undefined;
          if (!state.pendingRecommendationPrompt) {
            state.pendingRecommendationPrompt = prompt;
          }
          const askOriginReply =
            'Antes de realizar la búsqueda y recomendarte destinos (comprobando si tienen vuelos directos o con escalas), ¿desde qué ciudad o aeropuerto vas a salir?';
          return {
            sessionId,
            activeSkill: 'DESTINATION_RECOMMENDER',
            reply: askOriginReply,
            clarificationMessage: askOriginReply,
            isComplete: false,
            awaitingConfirmation: false,
            draftData: state.draft,
          };
        }

        if (
          state.activeSkill === 'DESTINATION_RECOMMENDER' &&
          this.needsBudgetTypeClarification(state.draft)
        ) {
          state.recommendations = undefined;
          if (!state.pendingRecommendationPrompt) {
            state.pendingRecommendationPrompt = prompt;
          }
          const rawBudget = state.draft.rawMaxPriceEur ?? state.draft.maxPriceEur;
          const askBudgetTypeReply = `Antes de realizar la búsqueda para los ${state.draft.adults} pasajeros, ¿el presupuesto máximo de ${rawBudget} EUR que has indicado es máximo por persona o máximo total?`;
          return {
            sessionId,
            activeSkill: 'DESTINATION_RECOMMENDER',
            reply: askBudgetTypeReply,
            clarificationMessage: askBudgetTypeReply,
            isComplete: false,
            awaitingConfirmation: false,
            draftData: state.draft,
          };
        }

        if (state.activeSkill === 'DESTINATION_RECOMMENDER' && state.draft.originIata) {
          const effectiveThemePrompt = (state.pendingRecommendationPrompt || prompt).toLowerCase();
          state.pendingRecommendationPrompt = undefined;
          let fallbackRecs = GENERAL_CHEAP_RECOMMENDATIONS;
          if (effectiveThemePrompt.includes('italia') || effectiveThemePrompt.includes('italiano')) {
            fallbackRecs = ITALY_RECOMMENDATIONS;
          } else if (
            effectiveThemePrompt.includes('playa') ||
            effectiveThemePrompt.includes('costa') ||
            effectiveThemePrompt.includes('sol')
          ) {
            fallbackRecs = BEACH_RECOMMENDATIONS;
          } else if (
            effectiveThemePrompt.includes('montaña') ||
            effectiveThemePrompt.includes('montana') ||
            effectiveThemePrompt.includes('nieve') ||
            effectiveThemePrompt.includes('alpes')
          ) {
            fallbackRecs = MOUNTAIN_RECOMMENDATIONS;
          }

          const candidateRecs: DestinationRecommendation[] =
            Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
              ? parsed.recommendations
              : fallbackRecs;

          const filteredRecs = this.excludeOriginFromRecommendations(
            state.draft.originIata,
            candidateRecs,
          );
          const verifiedRecs = await this.verifyDirectFlightsForRecommendations(
            state.draft.originIata,
            filteredRecs,
            state.draft,
          );
          state.recommendations = verifiedRecs;

          const adultsCount = state.draft.adults ?? 1;
          const missingAfterRec = this.getMissingFieldsAfterRecommendation(state.draft);
          const budgetContext =
            adultsCount > 1 && state.draft.maxPriceEur != null
              ? ` (presupuesto aplicado: máx. ${state.draft.maxPriceEur} EUR total / ${Number((state.draft.maxPriceEur / adultsCount).toFixed(2))} EUR por persona)`
              : '';
          const warningLine =
            validationErrors.length > 0 ? [`⚠️ ${validationErrors.join(' ')}`, ''] : [];
          const recReply = [
            ...warningLine,
            `🌟 Aquí tienes 5 recomendaciones de destinos saliendo desde ${state.draft.originIata}${budgetContext} (he comprobado cuáles disponen de vuelos directos desde tu origen).`,
            '',
            `¿Cuál de estos 5 destinos te gustaría elegir? Cuando elijas uno, dime también ${missingAfterRec}.`,
          ].join('\n');

          return {
            sessionId,
            activeSkill: 'DESTINATION_RECOMMENDER',
            reply: recReply,
            clarificationMessage: recReply,
            isComplete: false,
            awaitingConfirmation: false,
            recommendations: verifiedRecs,
            draftData: state.draft,
          };
        }

        if (validationErrors.length > 0) {
          state.awaitingConfirmation = false;
          const missing = this.getMissingFieldsDescription(state.draft);
          const validationReply = missing
            ? `⚠️ ${validationErrors.join(' ')} Para configurar tu alerta todavía necesito que me indiques: ${missing}.`
            : `⚠️ ${validationErrors.join(' ')} Por favor, corrige esos datos para continuar.`;
          return {
            sessionId,
            activeSkill: 'DEFINED_SEARCH',
            reply: validationReply,
            clarificationMessage: validationReply,
            isComplete: false,
            awaitingConfirmation: false,
            draftData: state.draft,
          };
        }

        if (this.isDraftComplete(state.draft)) {
          state.awaitingConfirmation = true;
          const fullData = this.toCompleteData(state.draft);
          const depName = this.getDayLabel(fullData.departureDay);
          const retName = this.getDayLabel(fullData.returnDay);
          const flightTypeText = fullData.directOnly
            ? 'Solo vuelos directos'
            : 'Con escalas permitidas';
          const budgetText =
            fullData.maxPriceEur == null
              ? 'Sin límite de precio'
              : fullData.adults > 1
                ? `${fullData.maxPriceEur} EUR en total (${Number((fullData.maxPriceEur / fullData.adults).toFixed(2))} EUR por persona)`
                : `${fullData.maxPriceEur} EUR`;
          const confirmReply = [
            `✅ Ya tengo todos los datos para tu alerta:`,
            `- Ruta: ${fullData.originIata} ➔ ${fullData.destinationIata}`,
            `- Días: Salida los ${depName} / Regreso los ${retName}`,
            `- Tipo de vuelo: ${flightTypeText}`,
            `- Pasajeros: ${fullData.adults}`,
            `- Presupuesto máx.: ${budgetText}`,
            `- Rango: ${fullData.startDate} al ${fullData.endDate}`,
            '',
            `¿Deseas que lance y active esta alerta ahora mismo?`,
          ].join('\n');
          return {
            sessionId,
            activeSkill: 'DEFINED_SEARCH',
            reply: confirmReply,
            isComplete: true,
            awaitingConfirmation: true,
            parsedData: fullData,
          };
        }

        let sanitizedReply = this.replaceDayNumbersInText(parsed.reply || '');
        if (
          state.activeSkill === 'DEFINED_SEARCH' &&
          this.needsBudgetTypeClarification(state.draft) &&
          !/por persona|total/i.test(sanitizedReply)
        ) {
          const rawBudget = state.draft.rawMaxPriceEur ?? state.draft.maxPriceEur;
          sanitizedReply = `${sanitizedReply.trim()} ¿El presupuesto de ${rawBudget} EUR para los ${state.draft.adults} pasajeros es máximo por persona o máximo total?`;
        }
        if (
          state.activeSkill === 'DEFINED_SEARCH' &&
          state.draft.directOnly === undefined &&
          !/directo|escala/i.test(sanitizedReply)
        ) {
          sanitizedReply = `${sanitizedReply.trim()} ¿Prefieres vuelo directo o con escalas?`;
        }
        return {
          sessionId,
          activeSkill: state.activeSkill,
          reply: sanitizedReply,
          clarificationMessage: sanitizedReply,
          isComplete: false,
          awaitingConfirmation: false,
          recommendations:
            state.activeSkill === 'DESTINATION_RECOMMENDER' ? state.recommendations : undefined,
          draftData: state.draft,
        };
      }
    } catch (error: any) {
      const apiDetail = error?.response?.data?.error?.message || error?.message;
      this.logger.error(`Error llamando a Gemini API, usando motor local: ${apiDetail}`);
    }

    return this.processWithSkillsEngine(prompt, state, sessionId);
  }

  private async verifyDirectFlightsForRecommendations(
    originIata: string,
    recommendations: DestinationRecommendation[],
    draft: ParsedAlertDraft,
  ): Promise<DestinationRecommendation[]> {
    const { departureDate, returnDate } = this.getSampleDatesForDirectCheck(draft);
    const adults = draft.adults ?? 1;

    return Promise.all(
      recommendations.map(async (rec) => {
        const knownDirect = this.hasKnownDirectRoute(originIata, rec.iataCode);
        let hasDirectFlights =
          knownDirect !== null
            ? knownDirect
            : typeof rec.hasDirectFlights === 'boolean'
              ? rec.hasDirectFlights
              : true;

        if (this.ignavAdapter) {
          try {
            const results = await this.ignavAdapter.searchFlights({
              originIata,
              destinationIata: rec.iataCode,
              departureDate,
              returnDate,
              adults,
              directOnly: false,
            });
            if (Array.isArray(results) && results.length > 0) {
              const foundDirectInSample = results.some(
                (f) => f.isDirect === true || f.stopsCount === 0,
              );
              if (foundDirectInSample) {
                hasDirectFlights = true;
              } else if (knownDirect === false || process.env.USE_IGNAV_MOCK !== 'false') {
                hasDirectFlights = false;
              }
            }
          } catch (err: any) {
            this.logger.warn(
              `No se pudo verificar vuelos directos en Ignav para ${originIata}->${rec.iataCode}, usando ruta conocida: ${err?.message}`,
            );
          }
        }

        return {
          ...rec,
          hasDirectFlights,
        };
      }),
    );
  }

  private getSampleDatesForDirectCheck(draft: ParsedAlertDraft): {
    departureDate: string;
    returnDate: string;
  } {
    if (draft.startDate) {
      const start = new Date(`${draft.startDate}T00:00:00Z`);
      if (!isNaN(start.getTime())) {
        const ret = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
        return {
          departureDate: draft.startDate,
          returnDate: ret.toISOString().split('T')[0],
        };
      }
    }
    const now = new Date();
    const dep = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const ret = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);
    return {
      departureDate: dep.toISOString().split('T')[0],
      returnDate: ret.toISOString().split('T')[0],
    };
  }

  private hasKnownDirectRoute(originIata: string, destinationIata: string): boolean | null {
    const origin = (originIata || '').toUpperCase();
    const dest = (destinationIata || '').toUpperCase();
    if (!origin || !dest || origin === dest) return false;
    if (dest === 'INN' || dest === 'XXX') return false;

    const commonEuropeanDirectDestinations = new Set([
      'PMI',
      'FAO',
      'TFS',
      'AGP',
      'ALC',
      'IBZ',
      'ACE',
      'LPA',
      'FUE',
      'MAH',
      'GVA',
      'BGY',
      'MXP',
      'TRN',
      'ZRH',
      'ROM',
      'FCO',
      'CIA',
      'VCE',
      'NAP',
      'FLR',
      'BLQ',
      'PSA',
      'OPO',
      'LIS',
      'LON',
      'LHR',
      'STN',
      'LGW',
      'LTN',
      'PAR',
      'CDG',
      'ORY',
      'BVA',
      'AMS',
      'BER',
      'FRA',
      'MUC',
      'BRU',
      'CRL',
      'VIE',
      'PRG',
      'BUD',
      'ATH',
      'DUB',
      'EDI',
      'MAD',
      'BCN',
      'VLC',
      'SVQ',
      'BIO',
      'SCQ',
      'ZAZ',
      'OVD',
      'SDR',
    ]);

    if (commonEuropeanDirectDestinations.has(dest)) {
      return true;
    }

    if ((origin === 'MAD' || origin === 'BCN') && ['JFK', 'DXB', 'HND', 'NRT', 'TYO'].includes(dest)) {
      return true;
    }

    return null;
  }

  private async resolveOriginFromDatabase(prompt: string, state: SessionState): Promise<void> {
    if (!(this.prisma as any)?.$queryRawUnsafe) return;
    const candidate = prompt
      .replace(/^(?:desde|saliendo de|salgo de|soy de|vivo en|origen(?:\s+en)?|el aeropuerto de)\s+/i, '')
      .replace(/[.,!?]/g, '')
      .trim();
    if (!candidate || candidate.length < 3 || candidate.length > 40) return;

    try {
      const rows = await (this.prisma as any).$queryRawUnsafe(
        `SELECT "iata" FROM "Airport"
         WHERE LOWER("city") = LOWER($1)
            OR LOWER("name") LIKE LOWER($2)
            OR LOWER("city") LIKE LOWER($2)
         ORDER BY "popularity" DESC
         LIMIT 1`,
        candidate,
        `${candidate}%`,
      );
      if (rows?.[0]?.iata) {
        state.draft.originIata = String(rows[0].iata).toUpperCase();
      }
    } catch {
      // ignore if table not available in mock tests
    }
  }

  private extractOriginFromReply(prompt: string, state: SessionState): void {
    const lower = prompt.toLowerCase().trim();

    for (const [city, iata] of Object.entries(CITY_TO_IATA)) {
      const regex = new RegExp(`(?:^|\\b)${city}(?:\\b|$)`, 'i');
      if (regex.test(lower)) {
        state.draft.originIata = iata;
        return;
      }
    }

    const upperIataMatch = prompt.match(/\b([A-Z]{3})\b/);
    if (upperIataMatch) {
      state.draft.originIata = upperIataMatch[1];
      return;
    }

    if (/^[a-zA-Z]{3}$/.test(prompt.trim())) {
      state.draft.originIata = prompt.trim().toUpperCase();
    }
  }

  private hasExplicitRouteInPrompt(prompt: string): boolean {
    if (/(?:de|desde)\s+[A-Z]{3}\s+(?:a|hacia)\s+[A-Z]{3}/.test(prompt)) {
      return true;
    }
    const lower = prompt.toLowerCase();
    for (const cityA of Object.keys(CITY_TO_IATA)) {
      if (lower.includes(`de ${cityA} a `) || lower.includes(`desde ${cityA} a `) || lower.includes(`de ${cityA} hacia `) || lower.includes(`desde ${cityA} hacia `)) {
        return true;
      }
    }
    return false;
  }

  private hasExplicitDestinationChoice(prompt: string, recommendations?: DestinationRecommendation[]): boolean {
    if (!recommendations || recommendations.length === 0) return false;
    const lower = prompt.toLowerCase();
    return recommendations.some(
      r => lower.includes(r.city.toLowerCase().split(' ')[0]) || prompt.toUpperCase().includes(r.iataCode),
    );
  }

  private excludeOriginFromRecommendations(
    originIata: string,
    recommendations: DestinationRecommendation[],
  ): DestinationRecommendation[] {
    const origin = (originIata || '').trim().toUpperCase();
    const seen = new Set<string>();
    const filtered: DestinationRecommendation[] = [];

    for (const rec of recommendations) {
      const code = (rec.iataCode || '').trim().toUpperCase();
      if (!code || code === origin || seen.has(code)) continue;
      seen.add(code);
      filtered.push({ ...rec, iataCode: code });
      if (filtered.length === 5) break;
    }

    if (filtered.length < 5) {
      for (const extra of FALLBACK_RECOMMENDATIONS_POOL) {
        const code = extra.iataCode.toUpperCase();
        if (code === origin || seen.has(code)) continue;
        seen.add(code);
        filtered.push({ ...extra, iataCode: code });
        if (filtered.length === 5) break;
      }
    }

    return filtered;
  }

  private extractExplicitDates(prompt: string): string[] {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    const toValidIso = (year: number, month: number, day: number): string | null => {
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      const d = new Date(Date.UTC(year, month - 1, day));
      if (
        d.getUTCFullYear() !== year ||
        d.getUTCMonth() + 1 !== month ||
        d.getUTCDate() !== day
      ) {
        return null;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const matches: { index: number; iso: string }[] = [];
    const monthAlternation = Object.keys(MONTH_NAMES).join('|');
    const combinedRegex = new RegExp(
      `\\b(\\d{4})-(\\d{2})-(\\d{2})\\b|\\b(\\d{1,2})[\\/-](\\d{1,2})[\\/-](20\\d{2})\\b|\\b(\\d{1,2})\\s+de\\s+(${monthAlternation})(?:\\s+(?:de|del)\\s+(20\\d{2}))?\\b`,
      'gi',
    );

    let m: RegExpExecArray | null;
    while ((m = combinedRegex.exec(prompt)) !== null) {
      let iso: string | null = null;
      if (m[1] && m[2] && m[3]) {
        // YYYY-MM-DD
        iso = toValidIso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      } else if (m[4] && m[5] && m[6]) {
        // DD/MM/YYYY o DD-MM-YYYY
        iso = toValidIso(parseInt(m[6], 10), parseInt(m[5], 10), parseInt(m[4], 10));
      } else if (m[7] && m[8]) {
        // DD de <mes> [de YYYY]
        const day = parseInt(m[7], 10);
        const monthNum = MONTH_NAMES[m[8].toLowerCase()];
        let year = m[9] ? parseInt(m[9], 10) : currentYear;
        if (!m[9] && monthNum < currentMonth) {
          year = currentYear + 1;
        }
        iso = toValidIso(year, monthNum, day);
      }

      if (iso) {
        matches.push({ index: m.index, iso });
      }
    }

    matches.sort((a, b) => a.index - b.index);
    return matches.map((entry) => entry.iso);
  }

  private sanitizeAndValidateDraft(draft: ParsedAlertDraft, existingErrors: string[] = []): string[] {
    const errors: string[] = [...existingErrors];
    const addUniqueError = (msg: string) => {
      if (!errors.includes(msg)) {
        errors.push(msg);
      }
    };

    if (draft.originIata) {
      draft.originIata = draft.originIata.trim().toUpperCase();
    }
    if (draft.destinationIata) {
      draft.destinationIata = draft.destinationIata.trim().toUpperCase();
    }

    if (draft.originIata && draft.destinationIata && draft.originIata === draft.destinationIata) {
      draft.destinationIata = undefined;
      addUniqueError('El aeropuerto de origen y el de destino no pueden ser el mismo.');
    }

    if (draft.startDate && draft.endDate) {
      const startKey = extractUtcDateKey(draft.startDate);
      const endKey = extractUtcDateKey(draft.endDate);

      if (!startKey || !endKey) {
        draft.startDate = undefined;
        draft.endDate = undefined;
        addUniqueError('Las fechas de inicio y fin deben ser válidas.');
      } else {
        draft.startDate = startKey;
        draft.endDate = endKey;
        const dateErrors = validateAlertSearchRules({
          departureDay: draft.departureDay,
          returnDay: draft.returnDay,
          startDate: startKey,
          endDate: endKey,
        });
        if (dateErrors.length > 0) {
          draft.startDate = undefined;
          draft.endDate = undefined;
          for (const err of dateErrors) {
            addUniqueError(err);
          }
        }
      }
    }

    return errors;
  }

  private extractEntitiesIntoDraft(prompt: string, state: SessionState, ignoreDestination = false): string[] {
    const lower = prompt.toLowerCase();
    const validationErrors: string[] = [];
    const addError = (msg: string) => {
      if (!validationErrors.includes(msg)) {
        validationErrors.push(msg);
      }
    };

    let candidateOrigin: string | undefined;
    let candidateDestination: string | undefined;

    // 1. Extraer códigos IATA explícitos en mayúsculas (ej. "de MAD a LON" o "(GVA)")
    const fromToIata = prompt.match(/(?:de|desde)\s+([A-Z]{3})\s+(?:a|hacia)\s+([A-Z]{3})/);
    if (fromToIata) {
      candidateOrigin = fromToIata[1].toUpperCase();
      if (!ignoreDestination) {
        candidateDestination = fromToIata[2].toUpperCase();
      }
    } else {
      const originMatch = prompt.match(/(?:desde|saliendo de|salgo de|origen(?:\s+en|\s*:)?)\s+([A-Z]{3})\b/);
      if (originMatch) {
        candidateOrigin = originMatch[1].toUpperCase();
      }
      if (!ignoreDestination) {
        const destMatch = prompt.match(/(?:destino(?:\s+en|\s*:)?|hacia|volar a|ir a)\s+([A-Z]{3})\b/);
        if (destMatch) {
          candidateDestination = destMatch[1].toUpperCase();
        }
        const parenIata = prompt.match(/\(([A-Z]{3})\)/);
        if (parenIata && !candidateDestination) {
          candidateDestination = parenIata[1].toUpperCase();
        }
      }
    }

    // 1.5. Si había 5 recomendaciones previas en la sesión y el usuario menciona el nombre de alguna de esas ciudades (ej. "Estocolmo", "Gotemburgo")
    if (!ignoreDestination && state.recommendations && state.recommendations.length > 0) {
      for (const rec of state.recommendations) {
        const mainCityName = rec.city.toLowerCase().split(/[(-]/)[0].trim();
        if (
          (mainCityName.length >= 3 && lower.includes(mainCityName)) ||
          prompt.toUpperCase().includes(rec.iataCode)
        ) {
          candidateDestination = rec.iataCode.toUpperCase();
          break;
        }
      }
    }

    // 2. Extraer por nombres de ciudades del catálogo general (comprobando origen y destino de forma independiente)
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryEnd = '(?=$|[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])';
    const boundaryStart = '(?:^|[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])';

    for (const [city, iata] of Object.entries(CITY_TO_IATA)) {
      const escapedCity = escapeRegex(city);
      const originCityRegex = new RegExp(
        `${boundaryStart}(?:desde|saliendo\\s+de|saliendo\\s+desde|salgo\\s+de|salgo\\s+desde|soy\\s+de|vivo\\s+en|origen(?:\\s+en|\\s*:)?|volando\\s+desde|vuelo\\s+desde)\\s+${escapedCity}${boundaryEnd}|${boundaryStart}de\\s+${escapedCity}\\s+(?:a|hacia)${boundaryEnd}`,
        'i',
      );
      const destCityRegex = new RegExp(
        `${boundaryStart}(?:a|hacia|destino(?:\\s+en|\\s*:)?|con|elijo|volar\\s+a|ir\\s+a)\\s+${escapedCity}${boundaryEnd}`,
        'i',
      );

      const matchedAsOrigin = originCityRegex.test(lower);
      const matchedAsDest = !ignoreDestination && destCityRegex.test(lower);

      if (matchedAsOrigin) {
        candidateOrigin = iata;
      }
      if (matchedAsDest) {
        candidateDestination = iata;
      }
      if (!matchedAsOrigin && !matchedAsDest && !ignoreDestination) {
        const bareCityRegex = new RegExp(`${boundaryStart}${escapedCity}${boundaryEnd}`, 'i');
        if (bareCityRegex.test(lower)) {
          const effectiveOrigin = candidateOrigin || state.draft.originIata;
          if (!effectiveOrigin) {
            candidateOrigin = iata;
          } else if (effectiveOrigin !== iata && !candidateDestination && !state.draft.destinationIata) {
            candidateDestination = iata;
          }
        }
      }
    }

    if (candidateOrigin) {
      state.draft.originIata = candidateOrigin;
    }
    if (candidateDestination && !ignoreDestination) {
      state.draft.destinationIata = candidateDestination;
    }

    if (
      state.draft.originIata &&
      state.draft.destinationIata &&
      state.draft.originIata.toUpperCase() === state.draft.destinationIata.toUpperCase()
    ) {
      state.draft.destinationIata = undefined;
      addError('El aeropuerto de origen y el de destino no pueden ser el mismo.');
    }

    // 3. Días de la semana explícitos o deducidos por duración ("finde", "3 días", "4 días")
    const foundDays: number[] = [];
    const words = lower.replace(/[.,]/g, '').split(/\s+/);
    for (const word of words) {
      if (DAY_NAMES[word]) {
        foundDays.push(DAY_NAMES[word]);
      }
    }
    if (foundDays.length >= 2) {
      state.draft.departureDay = foundDays[0];
      state.draft.returnDay = foundDays[1];
    } else if (foundDays.length === 1 && !state.draft.departureDay) {
      state.draft.departureDay = foundDays[0];
    } else if (!state.draft.departureDay || !state.draft.returnDay) {
      // Si menciona "finde", "fin de semana" o "viaje de 3 días", sugerimos por defecto Viernes (5) a Domingo (7)
      if (
        lower.includes('finde') ||
        lower.includes('fin de semana') ||
        /\b3\s*d[ií]as\b/.test(lower)
      ) {
        state.draft.departureDay = state.draft.departureDay || 5;
        state.draft.returnDay = state.draft.returnDay || 7;
      } else if (/\b4\s*d[ií]as\b/.test(lower)) {
        state.draft.departureDay = state.draft.departureDay || 4;
        state.draft.returnDay = state.draft.returnDay || 7;
      } else if (/\b2\s*d[ií]as\b/.test(lower)) {
        state.draft.departureDay = state.draft.departureDay || 6;
        state.draft.returnDay = state.draft.returnDay || 7;
      }
    }

    // 4. Número de pasajeros
    const paxMatch = lower.match(/(\d+)\s*(?:personas|pasajeros|adultos|pax)/);
    if (paxMatch) {
      state.draft.adults = parseInt(paxMatch[1], 10);
    }

    // 4.5. Preferencia de vuelo directo o con escalas
    if (
      /\b(con\s+escalas?|con\s+o\s+sin\s+escalas?|escalas?\s+permitidas?|me\s+da\s+igual|indiferente|cualquiera)\b/.test(
        lower,
      ) ||
      /^escalas?\b/.test(lower.trim())
    ) {
      state.draft.directOnly = false;
    } else if (
      /\b(sin\s+escalas?|solo\s+directos?|vuelos?\s+directos?|directos?)\b/.test(lower) &&
      !lower.includes('directo o con escalas')
    ) {
      state.draft.directOnly = true;
    }

    // 5. Presupuesto máximo (opcional) y tipo de presupuesto (por persona vs total)
    const wantsNoPriceLimit =
      /\b(sin\s+l[ií]mite(?:\s+de\s+precio)?|sin\s+presupuesto(?:\s+m[aá]ximo)?|sin\s+tope(?:\s+de\s+precio)?|cualquier\s+precio|da\s+igual\s+el\s+precio)\b/i.test(
        lower,
      );
    const priceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:euros|eur|€)/);
    if (priceMatch) {
      const parsedPrice = parseFloat(priceMatch[1].replace(',', '.'));
      state.draft.rawMaxPriceEur = parsedPrice;
      state.draft.maxPriceEur = parsedPrice;
    } else if (wantsNoPriceLimit) {
      state.draft.rawMaxPriceEur = undefined;
      state.draft.maxPriceEur = undefined;
      state.draft.budgetType = undefined;
    }

    if (
      /\b(por\s+persona|por\s+pasajero|por\s+adulto|por\s+cabeza|cada\s+uno|cada\s+pasajero|individual|m[aá]ximo\s+por\s+persona)\b/.test(
        lower,
      ) &&
      !lower.includes('por persona o')
    ) {
      state.draft.budgetType = 'PER_PERSON';
    } else if (
      /\b(en\s+total|presupuesto\s+total|m[aá]ximo\s+total|precio\s+total|total\s+para\s+todos|entre\s+todos|entre\s+los\s+\w+|por\s+todos)\b/.test(
        lower,
      ) ||
      /^(?:el\s+)?total[.!]*$/i.test(lower.trim())
    ) {
      state.draft.budgetType = 'TOTAL';
    }

    this.recalculateMaxPriceEur(state.draft);

    // 6. Fechas explícitas (YYYY-MM-DD, DD/MM/YYYY, "23 de noviembre de 2026") o deducción por mes/expresión temporal
    const explicitDates = this.extractExplicitDates(prompt);
    const mentionsSameDay =
      /\b(?:el\s+mismo\s+d[ií]a|en\s+el\s+mismo\s+d[ií]a|para\s+el\s+mismo\s+d[ií]a|ida\s+y\s+vuelta\s+en\s+el\s+d[ií]a|volver\s+el\s+mismo\s+d[ií]a)\b/i.test(
        lower,
      );

    if (explicitDates.length >= 2) {
      const [firstDate, secondDate] = explicitDates;
      if (firstDate === secondDate) {
        state.draft.startDate = undefined;
        state.draft.endDate = undefined;
        addError(
          'No se permiten búsquedas de ida y vuelta en el mismo día. La fecha de regreso (hasta) debe ser posterior a la fecha de salida (desde).',
        );
      } else if (firstDate > secondDate) {
        state.draft.startDate = undefined;
        state.draft.endDate = undefined;
        addError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      } else {
        state.draft.startDate = firstDate;
        state.draft.endDate = secondDate;
      }
    } else if (mentionsSameDay) {
      state.draft.startDate = undefined;
      state.draft.endDate = undefined;
      addError(
        'No se permiten búsquedas de ida y vuelta en el mismo día. La fecha de regreso (hasta) debe ser posterior a la fecha de salida (desde).',
      );
    } else if (explicitDates.length === 0) {
      const deduced = this.deduceMonthRange(lower);
      if (deduced) {
        state.draft.startDate = deduced.startDate;
        state.draft.endDate = deduced.endDate;
      }
    }

    return validationErrors;
  }

  private deduceMonthRange(lowerPrompt: string): { startDate: string; endDate: string } | null {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    // Caso A: "este mes"
    if (lowerPrompt.includes('este mes')) {
      return this.buildFullMonthRange(currentYear, currentMonth);
    }

    // Caso B: "mes que viene" o "próximo mes"
    if (lowerPrompt.includes('mes que viene') || lowerPrompt.includes('proximo mes') || lowerPrompt.includes('próximo mes')) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const year = currentMonth === 12 ? currentYear + 1 : currentYear;
      return this.buildFullMonthRange(year, nextMonth);
    }

    // Caso C: Nombre de mes explícito (ej. "en noviembre", "en noviembre de este año", "en febrero de 2027")
    for (const [monthName, monthNumber] of Object.entries(MONTH_NAMES)) {
      const regex = new RegExp(`\\b${monthName}\\b`);
      if (regex.test(lowerPrompt)) {
        let year = currentYear;

        const explicitYearMatch = lowerPrompt.match(/\b(20\d{2})\b/);
        if (explicitYearMatch) {
          year = parseInt(explicitYearMatch[1], 10);
        } else if (
          lowerPrompt.includes('año que viene') ||
          lowerPrompt.includes('ano que viene') ||
          lowerPrompt.includes('proximo año') ||
          lowerPrompt.includes('próximo año')
        ) {
          year = currentYear + 1;
        } else if (lowerPrompt.includes('este año') || lowerPrompt.includes('este ano')) {
          year = currentYear;
        } else if (monthNumber < currentMonth) {
          // Si dice solo "en febrero" y ya pasó este año, asume el próximo año
          year = currentYear + 1;
        }

        return this.buildFullMonthRange(year, monthNumber);
      }
    }

    return null;
  }

  private buildFullMonthRange(year: number, month: number): { startDate: string; endDate: string } {
    const mm = String(month).padStart(2, '0');
    // Día 0 del mes siguiente en UTC nos da el último día exacto del mes (28, 29, 30 o 31)
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dd = String(lastDay).padStart(2, '0');
    return {
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${dd}`,
    };
  }

  private needsBudgetTypeClarification(draft: ParsedAlertDraft): boolean {
    return Boolean(
      (draft.adults ?? 1) > 1 &&
        draft.maxPriceEur != null &&
        !draft.budgetType,
    );
  }

  private recalculateMaxPriceEur(draft: ParsedAlertDraft): void {
    if (draft.rawMaxPriceEur == null && draft.maxPriceEur != null) {
      draft.rawMaxPriceEur = Number(draft.maxPriceEur);
    }
    if (draft.rawMaxPriceEur == null) return;
    const adults = draft.adults ?? 1;
    if (adults > 1 && draft.budgetType === 'PER_PERSON') {
      draft.maxPriceEur = Number((draft.rawMaxPriceEur * adults).toFixed(2));
    } else {
      draft.maxPriceEur = Number(draft.rawMaxPriceEur);
    }
  }

  private isDraftComplete(draft: ParsedAlertDraft): boolean {
    return Boolean(
      draft.originIata &&
        draft.destinationIata &&
        draft.departureDay &&
        draft.returnDay &&
        draft.directOnly !== undefined &&
        draft.directOnly !== null &&
        !this.needsBudgetTypeClarification(draft) &&
        draft.startDate &&
        draft.endDate &&
        validateAlertSearchRules(draft).length === 0,
    );
  }

  private normalizeDraftFields(draft: ParsedAlertDraft): void {
    const parseDayVal = (val: any): number | undefined => {
      if (typeof val === 'number' && val >= 1 && val <= 7) return val;
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (DAY_NAMES[lower]) return DAY_NAMES[lower];
        const num = parseInt(lower, 10);
        if (num >= 1 && num <= 7) return num;
      }
      return undefined;
    };

    if (draft.departureDay !== undefined) {
      draft.departureDay = parseDayVal(draft.departureDay);
    }
    if (draft.returnDay !== undefined) {
      draft.returnDay = parseDayVal(draft.returnDay);
    }
    if (draft.adults !== undefined) {
      draft.adults = Math.max(1, Number(draft.adults) || 1);
    }
    if (draft.directOnly !== undefined && draft.directOnly !== null) {
      if (typeof draft.directOnly === 'boolean') {
        // keep boolean
      } else if (typeof draft.directOnly === 'string') {
        const s = (draft.directOnly as string).trim().toLowerCase();
        if (s === 'true' || s.includes('direct')) draft.directOnly = true;
        else if (s === 'false' || s.includes('escala')) draft.directOnly = false;
        else draft.directOnly = undefined;
      }
    }
    if (draft.budgetType !== undefined && draft.budgetType !== null) {
      const bt = String(draft.budgetType).trim().toUpperCase();
      if (bt === 'PER_PERSON' || bt.includes('PERSON') || bt.includes('PASAJERO')) {
        draft.budgetType = 'PER_PERSON';
      } else if (bt === 'TOTAL' || bt.includes('TOTAL')) {
        draft.budgetType = 'TOTAL';
      } else {
        draft.budgetType = undefined;
      }
    }
    if (draft.maxPriceEur != null) {
      draft.maxPriceEur = Number(draft.maxPriceEur);
    }
    this.recalculateMaxPriceEur(draft);
  }

  private toCompleteData(draft: ParsedAlertDraft) {
    return {
      originIata: draft.originIata!,
      destinationIata: draft.destinationIata!,
      departureDay: draft.departureDay!,
      returnDay: draft.returnDay!,
      adults: draft.adults ?? 1,
      directOnly: Boolean(draft.directOnly),
      maxPriceEur: draft.maxPriceEur ?? null,
      startDate: draft.startDate!,
      endDate: draft.endDate!,
    };
  }

  private getMissingFieldsAfterRecommendation(draft: ParsedAlertDraft): string {
    const missing: string[] = [];
    if (!draft.originIata) missing.push('desde qué ciudad sales');
    if (!draft.departureDay || !draft.returnDay) {
      missing.push('qué días de la semana quieres viajar');
    } else {
      missing.push(
        `si te viene bien volar de ${this.getDayLabel(draft.departureDay)} a ${this.getDayLabel(draft.returnDay)} (o prefieres otros días)`,
      );
    }
    if (!draft.startDate || !draft.endDate) missing.push('el rango de fechas o mes');
    if (this.needsBudgetTypeClarification(draft)) {
      missing.push(
        `si el presupuesto máximo de ${draft.rawMaxPriceEur ?? draft.maxPriceEur} EUR es máximo por persona o máximo total`,
      );
    }
    if (draft.directOnly === undefined) missing.push('si prefieres vuelo directo o con escalas');
    return missing.join(', ');
  }

  private getMissingFieldsDescription(draft: ParsedAlertDraft): string {
    const missing: string[] = [];
    if (!draft.originIata) missing.push('aeropuerto de origen');
    if (!draft.destinationIata) missing.push('destino');
    if (!draft.departureDay || !draft.returnDay) missing.push('día de la semana de salida y de regreso');
    if (this.needsBudgetTypeClarification(draft)) {
      missing.push(
        `si el presupuesto máximo de ${draft.rawMaxPriceEur ?? draft.maxPriceEur} EUR para los ${draft.adults} pasajeros es máximo por persona o máximo total`,
      );
    }
    if (!draft.startDate || !draft.endDate) missing.push('fechas de inicio y fin (YYYY-MM-DD)');
    if (draft.directOnly === undefined) missing.push('si prefieres vuelo directo o con escalas');
    return missing.join(', ');
  }

  private getDayLabel(day: number): string {
    return DAY_LABELS[day] || `Día ${day}`;
  }

  private replaceDayNumbersInText(text: string): string {
    return text.replace(/\b(?:d[ií]a\s*)?([1-7])\b(?=\s*(?:\(|de la semana|salida|regreso))/gi, (_, num) => {
      return DAY_LABELS[Number(num)] || num;
    });
  }

  private isAffirmative(text: string): boolean {
    const clean = text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return /^(si|claro|adelante|lanzala|ok|vale|confirmar|confirmo|por supuesto)(?:\b|[.,!]|$)/.test(clean);
  }

  private isNegative(text: string): boolean {
    const clean = text.trim().toLowerCase();
    return /^(no|cancelar|espera|cambiar|modificar)\b/.test(clean);
  }
}
