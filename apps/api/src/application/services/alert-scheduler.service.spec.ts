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
});
