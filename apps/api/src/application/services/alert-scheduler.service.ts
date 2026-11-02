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

    const tuples = this.dateCalculator.generateDateTuples(
      alert.startDate,
      alert.endDate,
      alert.departureDay,
      alert.returnDay,
    );

    if (tuples.length === 0) {
      return 0;
    }

    const payload: FlightSearchJobPayload = {
      alertId: alert.id,
      userId: alert.userId,
      telegramChatId: alert.user.telegramChatId,
      originIata: alert.originIata,
      destinationIata: alert.destinationIata,
      maxPriceEur: Number(alert.maxPriceEur),
      dateTuples: tuples.map(t => ({
        departureDate: t.departureDate.toISOString().split('T')[0],
        returnDate: t.returnDate.toISOString().split('T')[0],
      })),
    };

    await this.flightSearchQueue.add('search-flight', payload);

    this.logger.log(`Alerta ${alert.id} encolada con ${tuples.length} combinaciones de fechas`);
    return 1;
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
