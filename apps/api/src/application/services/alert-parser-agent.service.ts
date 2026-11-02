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
  londres: 'LON',
  paris: 'PAR',
  parís: 'PAR',
  roma: 'ROM',
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
  milan: 'MIL',
  milán: 'MIL',
  innsbruck: 'INN',
  turin: 'TRN',
  turín: 'TRN',
  lisboa: 'LIS',
  oporto: 'OPO',
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
          const created = await this.prisma.alert.create({
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
          createdAlertId = created.id;

          if (this.alertScheduler) {
            await this.alertScheduler.enqueueAlert(created.id);
          }
        }

        // Limpiar sesión tras crear la alerta
        this.sessions.delete(sessionId);

        const reply = `🚀 ¡Perfecto! He creado y encolado tu alerta de ${fullData.originIata} a ${fullData.destinationIata} (máx. ${fullData.maxPriceEur} EUR para ${fullData.adults} pasajero(s)). En cuanto encontremos vuelos te avisaremos por Telegram.`;
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
        const reply = 'Entendido, no he lanzado la alerta todavía. Dime qué dato quieres modificar (destino, fechas, días de la semana, pasajeros o presupuesto).';
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

      if (lower.includes('playa') || lower.includes('costa') || lower.includes('sol')) {
        recs = BEACH_RECOMMENDATIONS;
        themeName = 'baratos con playa';
      } else if (lower.includes('montaña') || lower.includes('montana') || lower.includes('nieve') || lower.includes('alpes')) {
        recs = MOUNTAIN_RECOMMENDATIONS;
        themeName = 'baratos de montaña';
      }

      state.recommendations = recs;
      // Extraer si ya dio origen o presupuesto en la misma frase
      this.extractEntitiesIntoDraft(prompt, state);

      const listText = recs
        .map((r, i) => `${i + 1}. **${r.city} (${r.iataCode})** - ${r.country} (~${r.estimatedPriceEur}€): ${r.reason}`)
        .join('\n');

      const reply = [
        `🌟 Aquí tienes **5 recomendaciones de destinos ${themeName}**:`,
        '',
        listText,
        '',
        '¿Cuál de estos 5 destinos te gustaría elegir? Dime también desde qué ciudad sales, qué días de la semana quieres viajar, rango de fechas y tu presupuesto máximo.',
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
      const reply = [
        `✅ Ya tengo todos los datos para tu alerta:`,
        `- **Ruta:** ${fullData.originIata} ➔ ${fullData.destinationIata}`,
        `- **Días:** Salida día ${fullData.departureDay} / Regreso día ${fullData.returnDay}`,
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
      const systemPrompt = `Eres un asistente experto en vuelos que opera bajo las siguientes SKILL.md cargadas dinámicamente:

=== SKILL 1: DEFINED_SEARCH ===
${this.skillsContent.DEFINED_SEARCH}

=== SKILL 2: DESTINATION_RECOMMENDER ===
${this.skillsContent.DESTINATION_RECOMMENDER}

Estado actual del borrador de la sesión: ${JSON.stringify(state.draft)}
Responde EXCLUSIVAMENTE un objeto JSON válido con la estructura:
{ "activeSkill": "DEFINED_SEARCH" | "DESTINATION_RECOMMENDER", "draft": {...}, "recommendations": [...] | null, "reply": "..." }`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nMensaje del usuario: "${prompt}"` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        },
      );

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        state.activeSkill = parsed.activeSkill || 'DEFINED_SEARCH';
        state.draft = { ...state.draft, ...(parsed.draft || {}) };
        if (parsed.recommendations) {
          state.recommendations = parsed.recommendations;
        }

        if (this.isDraftComplete(state.draft)) {
          state.awaitingConfirmation = true;
          const fullData = this.toCompleteData(state.draft);
          const confirmReply = `${parsed.reply || 'Tengo todos los datos.'}\n\n¿Deseas que lance y active esta alerta ahora mismo?`;
          return {
            sessionId,
            activeSkill: 'DEFINED_SEARCH',
            reply: confirmReply,
            isComplete: true,
            awaitingConfirmation: true,
            parsedData: fullData,
          };
        }

        return {
          sessionId,
          activeSkill: state.activeSkill,
          reply: parsed.reply,
          clarificationMessage: parsed.reply,
          isComplete: false,
          awaitingConfirmation: false,
          recommendations: parsed.recommendations || undefined,
          draftData: state.draft,
        };
      }
    } catch (error: any) {
      this.logger.error(`Error llamando a Gemini API, usando motor local: ${error?.message}`);
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

  private extractEntitiesIntoDraft(prompt: string, state: SessionState): void {
    const lower = prompt.toLowerCase();

    // 1. Extraer códigos IATA explícitos en mayúsculas (ej. "de MAD a LON" o "(GVA)")
    const fromToIata = prompt.match(/(?:de|desde)\s+([A-Z]{3})\s+(?:a|hacia)\s+([A-Z]{3})/);
    if (fromToIata) {
      state.draft.originIata = fromToIata[1];
      state.draft.destinationIata = fromToIata[2];
    } else {
      const originMatch = prompt.match(/(?:desde|saliendo de)\s+([A-Z]{3})/);
      if (originMatch) {
        state.draft.originIata = originMatch[1];
      }
      const parenIata = prompt.match(/\(([A-Z]{3})\)/);
      if (parenIata) {
        state.draft.destinationIata = parenIata[1];
      }
    }

    // 2. Extraer por nombres de ciudades si aún faltan
    for (const [city, iata] of Object.entries(CITY_TO_IATA)) {
      if (lower.includes(`desde ${city}`) || lower.includes(`de ${city} a`)) {
        state.draft.originIata = state.draft.originIata || iata;
      } else if (
        lower.includes(`a ${city}`) ||
        lower.includes(`con ${city}`) ||
        lower.includes(`elijo ${city}`) ||
        lower.includes(city)
      ) {
        if (state.draft.originIata !== iata && !state.draft.destinationIata) {
          state.draft.destinationIata = iata;
        }
      }
    }

    // 3. Días de la semana
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
    }

    // 4. Número de pasajeros
    const paxMatch = lower.match(/(\d+)\s*(?:personas|pasajeros|adultos|pax)/);
    if (paxMatch) {
      state.draft.adults = parseInt(paxMatch[1], 10);
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
        draft.maxPriceEur !== undefined &&
        draft.startDate &&
        draft.endDate,
    );
  }

  private toCompleteData(draft: ParsedAlertDraft) {
    return {
      originIata: draft.originIata!,
      destinationIata: draft.destinationIata!,
      departureDay: draft.departureDay!,
      returnDay: draft.returnDay!,
      adults: draft.adults ?? 1,
      maxPriceEur: draft.maxPriceEur!,
      startDate: draft.startDate!,
      endDate: draft.endDate!,
    };
  }

  private getMissingFieldsDescription(draft: ParsedAlertDraft): string {
    const missing: string[] = [];
    if (!draft.originIata) missing.push('aeropuerto de origen');
    if (!draft.destinationIata) missing.push('destino');
    if (!draft.departureDay || !draft.returnDay) missing.push('día de la semana de salida y de regreso');
    if (draft.maxPriceEur === undefined) missing.push('presupuesto máximo en euros');
    if (!draft.startDate || !draft.endDate) missing.push('fechas de inicio y fin (YYYY-MM-DD)');
    return missing.join(', ');
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
