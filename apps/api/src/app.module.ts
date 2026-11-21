import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './infrastructure/database/prisma.service';
import { TelegramAdapter } from './infrastructure/adapters/telegram.adapter';
import { IgnavAdapter } from './infrastructure/adapters/ignav.adapter';
import { FlightSearchProcessorService } from './application/services/flight-search-processor.service';
import { FlightSearchWorker } from './infrastructure/workers/flight-search.worker';
import { AlertParserAgentService } from './application/services/alert-parser-agent.service';
import { AlertSchedulerService } from './application/services/alert-scheduler.service';
import { FlightDateCalculatorService } from './domain/services/flight-date-calculator.service';
import { AlertsController } from './application/controllers/alerts.controller';
import { AgentController } from './application/controllers/agent.controller';
import { AuthController } from './application/controllers/auth.controller';
import { AirportsController } from './application/controllers/airports.controller';
import { HealthController } from './application/controllers/health.controller';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { TokenBlacklistService } from './infrastructure/auth/token-blacklist.service';
import { ApiGatewayGuard } from './infrastructure/auth/api-gateway.guard';

function buildRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    const dbPath = parsed.pathname?.replace('/', '');
    const db = dbPath ? parseInt(dbPath, 10) : undefined;

    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(db !== undefined && Number.isFinite(db) ? { db } : {}),
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
      // Dual-stack IPv4/IPv6: imprescindible para la red privada interna de Railway (*.railway.internal)
      family: 0,
      maxRetriesPerRequest: null,
    };
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  return {
    host,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
    ...(!isLocal ? { family: 0 } : {}),
    maxRetriesPerRequest: null,
  };
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret_dont_use_in_prod',
      signOptions: { expiresIn: (process.env.JWT_EXPIRATION || '7d') as any },
    }),
    BullModule.forRoot({
      connection: buildRedisConnection(),
    }),
    BullModule.registerQueue({
      name: 'flight-search-queue',
    }),
  ],
  controllers: [AlertsController, AgentController, AuthController, AirportsController, HealthController],
  providers: [
    PrismaService,
    TelegramAdapter,
    IgnavAdapter,
    AlertParserAgentService,
    {
      provide: FlightSearchProcessorService,
      useFactory: (ignav: IgnavAdapter, telegram: TelegramAdapter, prisma: PrismaService) => {
        return new FlightSearchProcessorService(ignav, telegram, prisma);
      },
      inject: [IgnavAdapter, TelegramAdapter, PrismaService],
    },
    FlightSearchWorker,
    FlightDateCalculatorService,
    AlertSchedulerService,
    TokenBlacklistService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ApiGatewayGuard,
    },
  ],
})
export class AppModule {}
