import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FlightSearchProcessorService, FlightSearchJobPayload } from '../../application/services/flight-search-processor.service';

@Processor('flight-search-queue', {
  concurrency: 1, // BullMQ limitará los workers concurrentes
  limiter: {
    max: 2,
    duration: 1000, // 2 peticiones/segundo según SPEC.md
  }
})
export class FlightSearchWorker extends WorkerHost {
  private readonly logger = new Logger(FlightSearchWorker.name);

  constructor(private readonly processorService: FlightSearchProcessorService) {
    super();
  }

  async process(job: Job<FlightSearchJobPayload, void, string>): Promise<void> {
    this.logger.log(`Procesando alerta de vuelo: ${job.data.alertId}`);
    try {
      await this.processorService.processJob(job.data);
      this.logger.log(`Alerta ${job.data.alertId} procesada correctamente`);
    } catch (error) {
      this.logger.error(`Error procesando alerta ${job.data.alertId}: ${error}`);
      throw error;
    }
  }
}
