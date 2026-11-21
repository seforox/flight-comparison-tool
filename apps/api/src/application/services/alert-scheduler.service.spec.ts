import { AlertSchedulerService } from './alert-scheduler.service';
import { FlightDateCalculatorService } from '../../domain/services/flight-date-calculator.service';

describe('AlertSchedulerService', () => {
  let scheduler: AlertSchedulerService;
  let mockPrisma: any;
  let dateCalculator: FlightDateCalculatorService;
  let mockQueue: any;

  beforeEach(() => {
    mockPrisma = {
      alert: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    dateCalculator = new FlightDateCalculatorService();
    mockQueue = {
      add: jest.fn(),
    };

    scheduler = new AlertSchedulerService(mockPrisma, dateCalculator, mockQueue);
  });

  it('should automatically mark alert as COMPLETED and not enqueue if endDate has expired', async () => {
    mockPrisma.alert.findUnique.mockResolvedValue({
      id: 'expired-alert-1',
      userId: 'user-1',
      status: 'ACTIVE',
      originIata: 'MAD',
      destinationIata: 'LON',
      departureDay: 1,
      returnDay: 3,
      maxPriceEur: 100,
      startDate: new Date('2020-01-01T00:00:00Z'),
      endDate: new Date('2020-01-31T23:59:59Z'), // Fecha pasada
      user: { telegramChatId: '12345' },
    });

    const result = await scheduler.enqueueAlert('expired-alert-1');

    expect(result).toBe(0);
    expect(mockPrisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'expired-alert-1' },
      data: { status: 'COMPLETED' },
    });
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('should only enqueue future date tuples and mark COMPLETED if no future tuples remain', async () => {
    // startDate y endDate donde ya no quedan tuplas futuras válidas
    const yesterday = new Date(Date.now() - 86400000 * 2);
    const tomorrow = new Date(Date.now() + 86400000); // Menos de 2 días, imposible hacer ida y vuelta

    mockPrisma.alert.findUnique.mockResolvedValue({
      id: 'no-future-tuples-alert',
      userId: 'user-1',
      status: 'ACTIVE',
      originIata: 'MAD',
      destinationIata: 'LON',
      departureDay: 1,
      returnDay: 3,
      maxPriceEur: 100,
      startDate: yesterday,
      endDate: tomorrow,
      user: { telegramChatId: '12345' },
    });

    const result = await scheduler.enqueueAlert('no-future-tuples-alert');

    expect(result).toBe(0);
    expect(mockPrisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'no-future-tuples-alert' },
      data: { status: 'COMPLETED' },
    });
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('should flag TRIGGERED alerts with completion prompt when handleCron runs and they have not been completed', async () => {
    mockPrisma.alert.findMany
      .mockResolvedValueOnce([{ id: 'triggered-alert-1' }])
      .mockResolvedValueOnce([]);

    await scheduler.handleCron();

    expect(scheduler.hasCompletionPrompt('triggered-alert-1')).toBe(true);

    await scheduler.clearCompletionPrompt('triggered-alert-1');
    expect(scheduler.hasCompletionPrompt('triggered-alert-1')).toBe(false);
  });

  it('should log the user email when enqueuing an active alert', async () => {
    const futureStart = new Date();
    futureStart.setUTCDate(futureStart.getUTCDate() + 10);
    const futureEnd = new Date(futureStart);
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 14);

    mockPrisma.alert.findUnique.mockResolvedValue({
      id: 'ad6810f0-563f-458d-9318-cd073b52b71f',
      userId: 'user-1',
      status: 'ACTIVE',
      originIata: 'MAD',
      destinationIata: 'LON',
      departureDay: 1,
      returnDay: 3,
      adults: 1,
      directOnly: true,
      maxPriceEur: 120,
      startDate: futureStart,
      endDate: futureEnd,
      user: {
        email: 'usuario@ejemplo.com',
        telegramChatId: '12345',
      },
    });

    const logSpy = jest.spyOn((scheduler as any).logger, 'log').mockImplementation();

    const result = await scheduler.enqueueAlert('ad6810f0-563f-458d-9318-cd073b52b71f');

    expect(result).toBe(1);
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Alerta ad6810f0-563f-458d-9318-cd073b52b71f encolada con \d+ combinaciones de fechas por usuario@ejemplo\.com$/,
      ),
    );
  });

  it('should track initial search lifecycle until markSearchCompleted is called', async () => {
    expect(await scheduler.isInitialSearchInProgress('new-alert-1', null)).toBe(false);

    scheduler.markInitialSearchStarted('new-alert-1');
    expect(await scheduler.isInitialSearchInProgress('new-alert-1', null)).toBe(true);

    await scheduler.markSearchCompleted('new-alert-1');
    expect(await scheduler.isInitialSearchInProgress('new-alert-1', null)).toBe(false);
    expect(scheduler.getLastCheckedAt('new-alert-1')).toBeTruthy();
  });

  it('should compute human-readable search interval and nextSearchAt from ALERT_CRON_SCHEDULE', () => {
    const prevCron = process.env.ALERT_CRON_SCHEDULE;
    try {
      delete process.env.ALERT_CRON_SCHEDULE;
      const baseDate = new Date(2026, 10, 21, 21, 55, 0, 0);
      const defaultInfo = scheduler.getSearchScheduleInfo(baseDate);
      expect(defaultInfo.intervalLabel).toBe('cada 6 horas');
      expect(defaultInfo.nextSearchAt).toBeTruthy();
      const nextDefault = new Date(defaultInfo.nextSearchAt!);
      expect(nextDefault.getHours()).toBe(0);
      expect(nextDefault.getMinutes()).toBe(0);

      process.env.ALERT_CRON_SCHEDULE = '*/15 * * * *';
      const minInfo = scheduler.getSearchScheduleInfo(baseDate);
      expect(minInfo.intervalLabel).toBe('cada 15 minutos');
      const nextMin = new Date(minInfo.nextSearchAt!);
      expect(nextMin.getHours()).toBe(22);
      expect(nextMin.getMinutes()).toBe(0);
    } finally {
      if (prevCron === undefined) {
        delete process.env.ALERT_CRON_SCHEDULE;
      } else {
        process.env.ALERT_CRON_SCHEDULE = prevCron;
      }
    }
  });
});
