import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AlertParserAgentService } from '../services/alert-parser-agent.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { AgentChatDto } from '../../domain/dtos/agent-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AlertParserAgentService) {}

  @Post('parse-alert')
  async parseAlert(@Request() req: any, @Body() body: AgentChatDto) {
    const userId = req.user.id;
    const sessionId = body.sessionId || `session-${userId}`;
    return this.agentService.chat(userId, body.prompt, sessionId);
  }

  @Post('chat')
  async chat(@Request() req: any, @Body() body: AgentChatDto) {
    const userId = req.user.id;
    const sessionId = body.sessionId || `session-${userId}`;
    return this.agentService.chat(userId, body.prompt, sessionId);
  }
}
