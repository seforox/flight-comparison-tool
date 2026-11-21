import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FlightDateCalculatorService } from '../../domain/services/flight-date-calculator.service';
import { FlightSearchJobPayload } from './flight-search-processor.service';

export interface SearchScheduleInfo {
  cronExpression: string;
  intervalLabel: string;
  nextSearchAt: string | null;
}

@Injectable()
export class AlertSchedulerService {
  private readonly logger = new Logger(AlertSchedulerService.name);
  private readonly promptedTriggeredAlerts = new Set<string>();
  private readonly initialSearchingAlerts = new Set<string>();
  private readonly lastCheckedAtMap = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dateCalculator: FlightDateCalculatorService,
    @InjectQueue('flight-search-queue') private readonly flightSearchQueue: Queue<FlightSearchJobPayload>,
  ) {}

  markInitialSearchStarted(alertId: string): void {
    this.initialSearchingAlerts.add(alertId);
  }

  async markSearchCompleted(alertId: string): Promise<void> {
    this.initialSearchingAlerts.delete(alertId);
    const now = new Date();
    this.lastCheckedAtMap.set(alertId, now.toISOString());

    if ((this.prisma as any).$executeRawUnsafe) {
      try {
        await (this.prisma as any).$executeRawUnsafe(
          `ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3)`,
        );
        await (this.prisma as any).$executeRawUnsafe(
          `UPDATE "Alert" SET "lastCheckedAt" = $1 WHERE "id" = $2`,
          now,
          alertId,
        );
      } catch {
        // ignore if raw SQL not supported in test mock
      }
    }
  }

  async isInitialSearchInProgress(
    alertId: string,
    lastCheckedAt?: Date | string | null,
  ): Promise<boolean> {
    if (this.initialSearchingAlerts.has(alertId)) {
      return true;
    }

    if (lastCheckedAt || this.lastCheckedAtMap.has(alertId)) {
      return false;
    }

    if (this.flightSearchQueue && typeof this.flightSearchQueue.getJob === 'function') {
      try {
        const job = await this.flightSearchQueue.getJob(alertId);
        if (job && typeof job.getState === 'function') {
          const state = await job.getState();
          if (
            state === 'waiting' ||
            state === 'active' ||
            state === 'delayed' ||
            state === 'prioritized'
          ) {
            return true;
          }
        }
      } catch {
        // ignore queue lookup errors
      }
    }

    return false;
  }

  getLastCheckedAt(alertId: string): string | null {
    return this.lastCheckedAtMap.get(alertId) ?? null;
  }

  getSearchScheduleInfo(now: Date = new Date()): SearchScheduleInfo {
    const cronExpression = (process.env.ALERT_CRON_SCHEDULE || '0 */6 * * *').trim();
    const intervalLabel = this.describeCronInterval(cronExpression);
    const nextDate = this.computeNextCronDate(cronExpression, now);
    return {
      cronExpression,
      intervalLabel,
      nextSearchAt: nextDate ? nextDate.toISOString() : null,
    };
  }

  private describeCronInterval(cronExpression: string): string {
    const parts = cronExpression.split(/\s+/).filter(Boolean);
    if (parts.length !== 5 && parts.length !== 6) {
      return 'de forma periódica';
    }

    const isSixField = parts.length === 6;
    const secField = isSixField ? parts[0] : null;
    const minField = isSixField ? parts[1] : parts[0];
    const hourField = isSixField ? parts[2] : parts[1];
    const domField = isSixField ? parts[3] : parts[2];
    const monthField = isSixField ? parts[4] : parts[3];
    const dowField = isSixField ? parts[5] : parts[4];

    if (secField && /^\*\/(\d+)$/.test(secField) && minField === '*' && hourField === '*') {
      const secs = Number(secField.slice(2));
      return secs === 1 ? 'cada segundo' : `cada ${secs} segundos`;
    }

    if (/^\*\/(\d+)$/.test(minField) && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
      const mins = Number(minField.slice(2));
      return mins === 1 ? 'cada minuto' : `cada ${mins} minutos`;
    }

    if (/^\d+$/.test(minField) && /^\*\/(\d+)$/.test(hourField) && domField === '*' && monthField === '*' && dowField === '*') {
      const hours = Number(hourField.slice(2));
      return hours === 1 ? 'cada hora' : `cada ${hours} horas`;
    }

    if (/^\d+$/.test(minField) && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
      return 'cada hora';
    }

    if (/^\d+$/.test(minField) && /^\d+$/.test(hourField) && domField === '*' && monthField === '*' && dowField === '*') {
      return 'cada 24 horas';
    }

    return 'de forma periódica';
  }

  private matchesCronField(value: number, field: string): boolean {
    if (field === '*') return true;
    const tokens = field.split(',');
    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      if (trimmed.includes('/')) {
        const [rangePart, stepPart] = trimmed.split('/');
        const step = parseInt(stepPart, 10);
        if (!Number.isFinite(step) || step <= 0) continue;

        if (rangePart === '*') {
          if (value % step === 0) return true;
        } else if (rangePart.includes('-')) {
          const [startStr, endStr] = rangePart.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (value >= start && value <= end && (value - start) % step === 0) return true;
        } else {
          const start = parseInt(rangePart, 10);
          if (value >= start && (value - start) % step === 0) return true;
        }
      } else if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (value >= start && value <= end) return true;
      } else {
        const exact = parseInt(trimmed, 10);
        if (exact === value) return true;
      }
    }
    return false;
  }

  private computeNextCronDate(cronExpression: string, from: Date): Date | null {
    const parts = cronExpression.split(/\s+/).filter(Boolean);
    if (parts.length !== 5 && parts.length !== 6) return null;

    const isSixField = parts.length === 6;
    const secField = isSixField ? parts[0] : '0';
    const minField = isSixField ? parts[1] : parts[0];
    const hourField = isSixField ? parts[2] : parts[1];
    const domField = isSixField ? parts[3] : parts[2];
    const monthField = isSixField ? parts[4] : parts[3];
    const dowField = isSixField ? parts[5] : parts[4];

    const stepBySeconds = isSixField && secField !== '0';
    const candidate = new Date(from.getTime());

    if (stepBySeconds) {
      candidate.setMilliseconds(0);
      candidate.setSeconds(candidate.getSeconds() + 1);
      for (let i = 0; i < 3600; i++) {
        const dow = candidate.getDay();
        const dowMatches =
          this.matchesCronField(dow, dowField) ||
          (dow === 0 && this.matchesCronField(7, dowField));
        if (
          this.matchesCronField(candidate.getSeconds(), secField) &&
          this.matchesCronField(candidate.getMinutes(), minField) &&
          this.matchesCronField(candidate.getHours(), hourField) &&
          this.matchesCronField(candidate.getDate(), domField) &&
          this.matchesCronField(candidate.getMonth() + 1, monthField) &&
          dowMatches
        ) {
          return candidate;
        }
        candidate.setSeconds(candidate.getSeconds() + 1);
      }
      return null;
    }

    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    // Buscar hasta 8 días hacia adelante (11520 minutos)
    for (let i = 0; i < 11520; i++) {
      const dow = candidate.getDay();
      const dowMatches =
        this.matchesCronField(dow, dowField) ||
        (dow === 0 && this.matchesCronField(7, dowField));
      if (
        this.matchesCronField(candidate.getMinutes(), minField) &&
        this.matchesCronField(candidate.getHours(), hourField) &&
        this.matchesCronField(candidate.getDate(), domField) &&
        this.matchesCronField(candidate.getMonth() + 1, monthField) &&
        dowMatches
      ) {
        return candidate;
      }
      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    return null;
  }

  hasCompletionPrompt(alertId: string): boolean {
    return this.promptedTriggeredAlerts.has(alertId);
  }

  async markCompletionPrompt(alertId: string): Promise<void> {
    this.promptedTriggeredAlerts.add(alertId);
    if ((this.prisma as any).$executeRawUnsafe) {
      try {
        await (this.prisma as any).$executeRawUnsafe(
          `ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "pendingCompletionPrompt" BOOLEAN NOT NULL DEFAULT false`,
        );
        await (this.prisma as any).$executeRawUnsafe(
          `UPDATE "Alert" SET "pendingCompletionPrompt" = true WHERE "id" = $1`,
          alertId,
        );
      } catch {
        // ignore if raw SQL not supported in test mock
      }
    }
  }

  async clearCompletionPrompt(alertId: string): Promise<void> {
    this.promptedTriggeredAlerts.delete(alertId);
    if ((this.prisma as any).$executeRawUnsafe) {
      try {
        await (this.prisma as any).$executeRawUnsafe(
          `UPDATE "Alert" SET "pendingCompletionPrompt" = false WHERE "id" = $1`,
          alertId,
        );
      } catch {
        // ignore
      }
    }
  }

  async enqueueAlert(alertId: string): Promise<number> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { user: true },
    });

    if (!alert || alert.status !== 'ACTIVE') {
      this.initialSearchingAlerts.delete(alertId);
      return 0;
    }

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    // 1. Si la fecha fin ya expiró, marcar automáticamente como COMPLETED
    if (new Date(alert.endDate) < now) {
      this.initialSearchingAlerts.delete(alert.id);
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'COMPLETED' as any },
      });
      this.logger.log(`Alerta ${alert.id} marcada como COMPLETED automáticamente (endDate expirada).`);
      return 0;
    }

    // Calcular desde hoy o desde startDate (la que sea posterior) para no buscar fechas en el pasado
    const effectiveStartDate = new Date(alert.startDate) > now ? new Date(alert.startDate) : now;

    const tuples = this.dateCalculator.generateDateTuples(
      effectiveStartDate,
      alert.endDate,
      alert.departureDay,
      alert.returnDay,
    );

    // 2. Si ya no quedan combinaciones futuras posibles antes del endDate, marcar como COMPLETED
    if (tuples.length === 0) {
      this.initialSearchingAlerts.delete(alert.id);
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'COMPLETED' as any },
      });
      this.logger.log(`Alerta ${alert.id} marcada como COMPLETED automáticamente (sin combinaciones futuras posibles).`);
      return 0;
    }

    let directOnly = Boolean((alert as any).directOnly);
    if ((alert as any).directOnly === undefined && (this.prisma as any).$queryRawUnsafe) {
      try {
        const rows = await (this.prisma as any).$queryRawUnsafe(
          `SELECT "directOnly" FROM "Alert" WHERE "id" = $1 LIMIT 1`,
          alert.id,
        );
        if (rows?.[0] !== undefined) {
          directOnly = Boolean(rows[0].directOnly);
        }
      } catch {
        // ignore
      }
    }

    const payload: FlightSearchJobPayload = {
      alertId: alert.id,
      userId: alert.userId,
      telegramChatId: alert.user.telegramChatId,
      originIata: alert.originIata,
      destinationIata: alert.destinationIata,
      adults: (alert as any).adults ?? 1,
      directOnly,
      maxPriceEur: Number(alert.maxPriceEur),
      dateTuples: tuples.map(t => ({
        departureDate: t.departureDate.toISOString().split('T')[0],
        returnDate: t.returnDate.toISOString().split('T')[0],
      })),
    };

    await this.flightSearchQueue.add('search-flight', payload, {
      jobId: alert.id,
      removeOnComplete: true,
      removeOnFail: true,
    });

    const userEmail = alert.user?.email || alert.userId;
    this.logger.log(
      `Alerta ${alert.id} encolada con ${tuples.length} combinaciones de fechas por ${userEmail}`,
    );
    return 1;
  }

  async cancelAlertJobs(alertId: string): Promise<void> {
    this.initialSearchingAlerts.delete(alertId);
    try {
      const job = await this.flightSearchQueue.getJob(alertId);
      if (job) {
        await job.remove();
        this.logger.log(`Trabajo en cola eliminado para la alerta ${alertId}`);
      }
    } catch (error) {
      this.logger.warn(`No se pudo eliminar el trabajo en cola de la alerta ${alertId}: ${error}`);
    }
  }

  @Cron(process.env.ALERT_CRON_SCHEDULE || '0 */6 * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Ejecutando Cron Job de revisión de alertas...');

    // 1. Alertas en estado TRIGGERED (Vuelo encontrado) que el usuario aún no ha cambiado a COMPLETED
    const triggeredAlerts = await this.prisma.alert.findMany({
      where: { status: 'TRIGGERED' as any },
      select: { id: true },
    });

    for (const triggered of triggeredAlerts || []) {
      await this.markCompletionPrompt(triggered.id);
      this.logger.log(
        `Alerta ${triggered.id} sigue en TRIGGERED al pasar el Cron sin completarse: ofreciendo completarla o mantenerla.`,
      );
    }

    // 2. Alertas en estado ACTIVE
    const activeAlerts = await this.prisma.alert.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    let totalJobs = 0;
    for (const alert of activeAlerts || []) {
      totalJobs += await this.enqueueAlert(alert.id);
    }

    this.logger.log(
      `Cron finalizado: ${activeAlerts?.length ?? 0} alertas activas revisadas (${totalJobs} trabajos encolados) y ${triggeredAlerts?.length ?? 0} alertas con vuelo encontrado notificadas para completar o mantener.`,
    );
  }
}
