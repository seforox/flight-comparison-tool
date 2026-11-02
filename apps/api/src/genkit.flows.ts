import 'dotenv/config';
import { genkit, z } from 'genkit';
import { AlertParserAgentService } from './application/services/alert-parser-agent.service';

export const ai = genkit({});

const agentService = new AlertParserAgentService();

const AgentChatInputSchema = z.object({
  sessionId: z
    .string()
    .default('genkit-ui-session')
    .describe('ID de la conversación para mantener memoria entre turnos'),
  prompt: z
    .string()
    .describe(
      'Mensaje del usuario (ej. "Recomiéndame sitios baratos con playa" o "Vuelos de MAD a LON de lunes a miercoles por menos de 80 euros entre 2026-11-01 y 2026-11-30")',
    ),
});

const RecommendationSchema = z.object({
  city: z.string(),
  iataCode: z.string(),
  country: z.string(),
  estimatedPriceEur: z.number(),
  reason: z.string(),
});

const AgentChatOutputSchema = z.object({
  sessionId: z.string(),
  activeSkill: z.enum(['DEFINED_SEARCH', 'DESTINATION_RECOMMENDER']),
  reply: z.string(),
  isComplete: z.boolean(),
  awaitingConfirmation: z.boolean(),
  alertCreated: z.boolean().optional(),
  recommendations: z.array(RecommendationSchema).optional(),
  parsedData: z
    .object({
      originIata: z.string(),
      destinationIata: z.string(),
      departureDay: z.number(),
      returnDay: z.number(),
      adults: z.number(),
      maxPriceEur: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    })
    .optional(),
});

/**
 * Flow principal unificado (Router Multi-Skill + Memoria de Sesión)
 */
export const flightAgentChatFlow = ai.defineFlow(
  {
    name: 'flightAgentChatFlow',
    inputSchema: AgentChatInputSchema,
    outputSchema: AgentChatOutputSchema,
  },
  async input => {
    return agentService.chat('genkit-ui-user', input.prompt, input.sessionId);
  },
);

/**
 * Flow dedicado a la Skill 2: Recomendador Inspiracional (5 destinos)
 */
export const destinationRecommenderFlow = ai.defineFlow(
  {
    name: 'destinationRecommenderSkill',
    inputSchema: z.object({
      preference: z
        .string()
        .default('Sitios baratos con playa')
        .describe('Preferencia del viajero: playa, montaña o escapada barata'),
    }),
    outputSchema: AgentChatOutputSchema,
  },
  async input => {
    return agentService.chat('genkit-ui-user', `Recomiéndame ${input.preference}`, 'genkit-rec-session');
  },
);
