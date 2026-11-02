import { IsOptional, IsString, MinLength } from 'class-validator';

export class AgentChatDto {
  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
