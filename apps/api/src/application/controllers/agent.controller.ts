import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AlertParserAgentService } from '../services/alert-parser-agent.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AlertParserAgentService) {}

  @Post('parse-alert')
  async parseAlert(@Body('prompt') prompt: string) {
    if (!prompt) {
      return { error: 'Se requiere el parámetro prompt' };
    }
    const result = await this.agentService.parsePrompt(prompt);
    return result;
  }
}
