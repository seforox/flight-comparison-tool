export interface AgentParseResult {
  isComplete: boolean;
  clarificationMessage?: string;
  parsedData?: {
    originIata: string;
    destinationIata: string;
    departureDay: number;
    returnDay: number;
    maxPriceEur: number;
    startDate: string;
    endDate: string;
  };
}

export class AlertParserAgentService {
  async parsePrompt(prompt: string): Promise<AgentParseResult> {
    // Delegamos a la capa de integración de Genkit
    return this.callGenkitLlm(prompt);
  }

  // Aislamos la llamada externa para permitir el testing unitario y la futura inyección real
  private async callGenkitLlm(prompt: string): Promise<AgentParseResult> {
    // TODO: Implementar generate() de @genkit-ai/ai usando el schema Zod
    throw new Error('Real LLM call not implemented in unit tests');
  }
}
