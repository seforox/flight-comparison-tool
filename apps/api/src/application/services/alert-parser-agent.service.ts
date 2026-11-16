import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AlertSchedulerService } from './alert-scheduler.service';

export type AgentSkill = 'DEFINED_SEARCH' | 'DESTINATION_RECOMMENDER';

export interface DestinationRecommendation {
  city: string;
  iataCode: string;
  country: string;
  estimatedPriceEur: number;
  reason: string;
}

export interface ParsedAlertDraft {
  originIata?: string;
  destinationIata?: string;
  departureDay?: number;
  returnDay?: number;
  adults?: number;
  directOnly?: boolean;
  maxPriceEur?: number;
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
    maxPriceEur: number;
    startDate: string;
    endDate: string;
  };
  draftData?: ParsedAlertDraft;
}

interface SessionState {
  activeSkill: AgentSkill;
  draft: ParsedAlertDraft;
  recommendations?: DestinationRecommendation[];
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
};

const BEACH_RECOMMENDATIONS: DestinationRecommendation[] = [
  {
    city: 'Palma de Mallorca',
    iataCode: 'PMI',
    country: 'España',
    estimatedPriceEur: 35,
    reason: 'Calas de agua cristalina y vuelos directos ultra-económicos todo el año.',
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

@Injectable()
export class AlertParserAgentService {
  private readonly logger = new Logger(AlertParserAgentService.name);
  private readonly sessions = new Map<string, SessionState>();
  private readonly skillsContent: Record<AgentSkill, string>;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly alertScheduler?: AlertSchedulerService,
  ) {
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
            await this.alertScheduler.enqueueAlert(created.id);
          }
        }

        // Limpiar sesión tras crear la alerta
        this.sessions.delete(sessionId);

        const depName = this.getDayLabel(fullData.departureDay);
        const retName = this.getDayLabel(fullData.returnDay);
        const flightTypeLabel = fullData.directOnly ? 'solo vuelos directos' : 'con escalas permitidas';
        const reply = `🚀 ¡Perfecto! He creado y encolado tu alerta de ${fullData.originIata} a ${fullData.destinationIata} (salida los ${depName} y regreso los ${retName}, ${flightTypeLabel}, máx. ${fullData.maxPriceEur} EUR para ${fullData.adults} pasajero(s)). En cuanto encontremos vuelos te avisaremos por Telegram.`;
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

    if (wantsRecommendation) {
      state.activeSkill = 'DESTINATION_RECOMMENDER';
      let recs = GENERAL_CHEAP_RECOMMENDATIONS;
      let themeName = 'económicos en Europa';

      if (lower.includes('italia') || lower.includes('italiano')) {
        recs = ITALY_RECOMMENDATIONS;
        themeName = 'en Italia';
      } else if (lower.includes('playa') || lower.includes('costa') || lower.includes('sol')) {
        recs = BEACH_RECOMMENDATIONS;
        themeName = 'baratos con playa';
      } else if (lower.includes('montaña') || lower.includes('montana') || lower.includes('nieve') || lower.includes('alpes')) {
        recs = MOUNTAIN_RECOMMENDATIONS;
        themeName = 'baratos de montaña';
      }

      state.recommendations = recs;
      // Extraer si ya dio origen, mes ("en enero"), duración ("3 días") o presupuesto en la misma frase
      this.extractEntitiesIntoDraft(prompt, state, true);

      const listText = recs
        .map((r, i) => `${i + 1}. **${r.city} (${r.iataCode})** - ${r.country} (~${r.estimatedPriceEur}€): ${r.reason}`)
        .join('\n');

      const missingAfterRec = this.getMissingFieldsAfterRecommendation(state.draft);

      const reply = [
        `🌟 Aquí tienes **5 recomendaciones de destinos ${themeName}**:`,
        '',
        listText,
        '',
        `¿Cuál de estos 5 destinos te gustaría elegir? Cuando elijas uno, dime también ${missingAfterRec}.`,
      ].join('\n');

      return {
        sessionId,
        activeSkill: 'DESTINATION_RECOMMENDER',
        reply,
        isComplete: false,
        awaitingConfirmation: false,
        recommendations: recs,
        draftData: state.draft,
      };
    }

    // Skill 1: DEFINED_SEARCH (o transición desde recomendador cuando elige un destino)
    state.activeSkill = 'DEFINED_SEARCH';
    this.extractEntitiesIntoDraft(prompt, state);

    if (this.isDraftComplete(state.draft)) {
      state.awaitingConfirmation = true;
      const fullData = this.toCompleteData(state.draft);
      const depName = this.getDayLabel(fullData.departureDay);
      const retName = this.getDayLabel(fullData.returnDay);
      const flightTypeText = fullData.directOnly
        ? 'Solo vuelos directos'
        : 'Con escalas permitidas';
      const reply = [
        `✅ Ya tengo todos los datos para tu alerta:`,
        `- **Ruta:** ${fullData.originIata} ➔ ${fullData.destinationIata}`,
        `- **Días:** Salida los ${depName} / Regreso los ${retName}`,
        `- **Tipo de vuelo:** ${flightTypeText}`,
        `- **Pasajeros:** ${fullData.adults}`,
        `- **Presupuesto máx.:** ${fullData.maxPriceEur} EUR`,
        `- **Rango:** ${fullData.startDate} al ${fullData.endDate}`,
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

    try {
      const currentYear = new Date().getUTCFullYear();
      const systemPrompt = `Eres Vera, una asistente experta en vuelos que opera bajo las siguientes SKILL.md cargadas dinámicamente.
Fecha actual UTC: ${new Date().toISOString().split('T')[0]} (año actual: ${currentYear}).

=== SKILL 1: DEFINED_SEARCH ===
${this.skillsContent.DEFINED_SEARCH}

=== SKILL 2: DESTINATION_RECOMMENDER ===
${this.skillsContent.DESTINATION_RECOMMENDER}

Estado actual del borrador de la sesión: ${JSON.stringify(state.draft)}
IMPORTANTE:
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
        state.activeSkill = parsed.activeSkill || 'DEFINED_SEARCH';
        // Combinar tanto la extracción determinista local (fechas de meses, duración, ciudades) como la de Gemini
        this.extractEntitiesIntoDraft(
          prompt,
          state,
          state.activeSkill === 'DESTINATION_RECOMMENDER',
        );
        if (parsed.draft && typeof parsed.draft === 'object') {
          for (const [k, v] of Object.entries(parsed.draft)) {
            if (v !== null && v !== undefined && v !== '') {
              (state.draft as any)[k] = v;
            }
          }
          this.normalizeDraftFields(state.draft);
        }
        if (parsed.recommendations) {
          state.recommendations = parsed.recommendations;
        }

        if (this.isDraftComplete(state.draft)) {
          state.awaitingConfirmation = true;
          const fullData = this.toCompleteData(state.draft);
          const depName = this.getDayLabel(fullData.departureDay);
          const retName = this.getDayLabel(fullData.returnDay);
          const flightTypeText = fullData.directOnly
            ? 'Solo vuelos directos'
            : 'Con escalas permitidas';
          const confirmReply = [
            `✅ Ya tengo todos los datos para tu alerta:`,
            `- **Ruta:** ${fullData.originIata} ➔ ${fullData.destinationIata}`,
            `- **Días:** Salida los ${depName} / Regreso los ${retName}`,
            `- **Tipo de vuelo:** ${flightTypeText}`,
            `- **Pasajeros:** ${fullData.adults}`,
            `- **Presupuesto máx.:** ${fullData.maxPriceEur} EUR`,
            `- **Rango:** ${fullData.startDate} al ${fullData.endDate}`,
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
          recommendations: parsed.recommendations || undefined,
          draftData: state.draft,
        };
      }
    } catch (error: any) {
      const apiDetail = error?.response?.data?.error?.message || error?.message;
      this.logger.error(`Error llamando a Gemini API, usando motor local: ${apiDetail}`);
    }

    return this.processWithSkillsEngine(prompt, state, sessionId);
  }

  private hasExplicitDestinationChoice(prompt: string, recommendations?: DestinationRecommendation[]): boolean {
    if (!recommendations || recommendations.length === 0) return false;
    const lower = prompt.toLowerCase();
    return recommendations.some(
      r => lower.includes(r.city.toLowerCase().split(' ')[0]) || prompt.toUpperCase().includes(r.iataCode),
    );
  }

  private extractEntitiesIntoDraft(prompt: string, state: SessionState, ignoreDestination = false): void {
    const lower = prompt.toLowerCase();

    // 1. Extraer códigos IATA explícitos en mayúsculas (ej. "de MAD a LON" o "(GVA)")
    const fromToIata = prompt.match(/(?:de|desde)\s+([A-Z]{3})\s+(?:a|hacia)\s+([A-Z]{3})/);
    if (fromToIata) {
      state.draft.originIata = fromToIata[1];
      if (!ignoreDestination) {
        state.draft.destinationIata = fromToIata[2];
      }
    } else {
      const originMatch = prompt.match(/(?:desde|saliendo de)\s+([A-Z]{3})/);
      if (originMatch) {
        state.draft.originIata = originMatch[1];
      }
      const parenIata = prompt.match(/\(([A-Z]{3})\)/);
      if (parenIata && !ignoreDestination) {
        state.draft.destinationIata = parenIata[1];
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
          state.draft.destinationIata = rec.iataCode;
          break;
        }
      }
    }

    // 2. Extraer por nombres de ciudades del catálogo general
    for (const [city, iata] of Object.entries(CITY_TO_IATA)) {
      if (
        lower.includes(`desde ${city}`) ||
        lower.includes(`saliendo de ${city}`) ||
        lower.includes(`de ${city} a `) ||
        lower.includes(`de ${city} hacia `)
      ) {
        state.draft.originIata = iata;
      } else if (
        !ignoreDestination &&
        (lower.includes(`a ${city}`) ||
          lower.includes(`hacia ${city}`) ||
          lower.includes(`con ${city}`) ||
          lower.includes(`elijo ${city}`))
      ) {
        if (state.draft.originIata !== iata) {
          state.draft.destinationIata = iata;
        }
      } else if (!ignoreDestination && lower.includes(city)) {
        if (!state.draft.originIata) {
          state.draft.originIata = iata;
        } else if (state.draft.originIata !== iata && !state.draft.destinationIata) {
          state.draft.destinationIata = iata;
        }
      }
    }

    // 3. Días de la semana explícitos o deducidos por duración ("finde", "3 días", "4 días")
    const foundDays: number[] = [];
    const words = lower.replace(/[.,]/g, '').split(/\s+/);
    for (const word of words) {
      if (DAY_NAMES[word] && !foundDays.includes(DAY_NAMES[word])) {
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

    // 5. Presupuesto máximo
    const priceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:euros|eur|€)/);
    if (priceMatch) {
      state.draft.maxPriceEur = parseFloat(priceMatch[1].replace(',', '.'));
    }

    // 6. Fechas YYYY-MM-DD explícitas o deducción por mes/expresión temporal
    const dateMatches = prompt.match(/\d{4}-\d{2}-\d{2}/g);
    if (dateMatches && dateMatches.length >= 2) {
      state.draft.startDate = dateMatches[0];
      state.draft.endDate = dateMatches[1];
    } else {
      const deduced = this.deduceMonthRange(lower);
      if (deduced) {
        state.draft.startDate = deduced.startDate;
        state.draft.endDate = deduced.endDate;
      }
    }
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

  private isDraftComplete(draft: ParsedAlertDraft): boolean {
    return Boolean(
      draft.originIata &&
        draft.destinationIata &&
        draft.departureDay &&
        draft.returnDay &&
        draft.directOnly !== undefined &&
        draft.directOnly !== null &&
        draft.maxPriceEur !== undefined &&
        draft.startDate &&
        draft.endDate,
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
    if (draft.maxPriceEur !== undefined) {
      draft.maxPriceEur = Number(draft.maxPriceEur);
    }
  }

  private toCompleteData(draft: ParsedAlertDraft) {
    return {
      originIata: draft.originIata!,
      destinationIata: draft.destinationIata!,
      departureDay: draft.departureDay!,
      returnDay: draft.returnDay!,
      adults: draft.adults ?? 1,
      directOnly: Boolean(draft.directOnly),
      maxPriceEur: draft.maxPriceEur!,
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
    if (draft.maxPriceEur === undefined) missing.push('tu presupuesto máximo en euros');
    if (draft.directOnly === undefined) missing.push('si prefieres vuelo directo o con escalas');
    return missing.join(', ');
  }

  private getMissingFieldsDescription(draft: ParsedAlertDraft): string {
    const missing: string[] = [];
    if (!draft.originIata) missing.push('aeropuerto de origen');
    if (!draft.destinationIata) missing.push('destino');
    if (!draft.departureDay || !draft.returnDay) missing.push('día de la semana de salida y de regreso');
    if (draft.maxPriceEur === undefined) missing.push('presupuesto máximo en euros');
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
