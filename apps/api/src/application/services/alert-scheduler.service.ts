import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FlightDateCalculatorService } from '../../domain/services/flight-date-calculator.service';
import { FlightSearchJobPayload } from './flight-search-processor.service';

@Injectable()
export class AlertSchedulerService {
  private readonly logger = new Logger(AlertSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dateCalculator: FlightDateCalculatorService,
    @InjectQueue('flight-search-queue') private readonly flightSearchQueue: Queue<FlightSearchJobPayload>,
  ) {}

  async enqueueAlert(alertId: string): Promise<number> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { user: true },
    });

    if (!alert || alert.status !== 'ACTIVE') {
      return 0;
    }

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    // 1. Si la fecha fin ya expiró, marcar automáticamente como COMPLETED
    if (new Date(alert.endDate) < now) {
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
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'COMPLETED' as any },
      });
      this.logger.log(`Alerta ${alert.id} marcada como COMPLETED automáticamente (sin combinaciones futuras posibles).`);
      return 0;
    }

    const payload: FlightSearchJobPayload = {
      alertId: alert.id,
      userId: alert.userId,
      telegramChatId: alert.user.telegramChatId,
      originIata: alert.originIata,
      destinationIata: alert.destinationIata,
      adults: (alert as any).adults ?? 1,
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

    this.logger.log(`Alerta ${alert.id} encolada con ${tuples.length} combinaciones de fechas`);
    return 1;
  }

  async cancelAlertJobs(alertId: string): Promise<void> {
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
    this.logger.log('Ejecutando Cron Job de revisión de alertas activas...');
    const activeAlerts = await this.prisma.alert.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    let totalJobs = 0;
    for (const alert of activeAlerts) {
      totalJobs += await this.enqueueAlert(alert.id);
    }

    this.logger.log(`Cron finalizado: ${activeAlerts.length} alertas revisadas (${totalJobs} trabajos encolados).`);
  }
}
