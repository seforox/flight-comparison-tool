import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './infrastructure/database/prisma.service';
import { TelegramAdapter } from './infrastructure/adapters/telegram.adapter';
import { AmadeusAdapter } from './infrastructure/adapters/amadeus.adapter';
import { FlightSearchProcessorService } from './application/services/flight-search-processor.service';
import { FlightSearchWorker } from './infrastructure/workers/flight-search.worker';
import { AlertParserAgentService } from './application/services/alert-parser-agent.service';
import { AlertsController } from './application/controllers/alerts.controller';
import { AgentController } from './application/controllers/agent.controller';
import { AuthController } from './application/controllers/auth.controller';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret_dont_use_in_prod',
      signOptions: { expiresIn: process.env.JWT_EXPIRATION || '7d' },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({
      name: 'flight-search-queue',
    }),
  ],
  controllers: [AlertsController, AgentController, AuthController],
  providers: [
    PrismaService,
    TelegramAdapter,
    AmadeusAdapter,
    AlertParserAgentService,
    {
      provide: FlightSearchProcessorService,
      useFactory: (amadeus: AmadeusAdapter, telegram: TelegramAdapter, prisma: PrismaService) => {
        return new FlightSearchProcessorService(amadeus, telegram, prisma);
      },
      inject: [AmadeusAdapter, TelegramAdapter, PrismaService],
    },
    FlightSearchWorker,
    JwtStrategy,
  ],
})
export class AppModule {}
