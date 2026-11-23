import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AlertsController } from './alerts.controller';
import { CreateAlertDto } from '../../domain/dtos/create-alert.dto';

describe('AlertsController (Validación de búsquedas)', () => {
  let controller: AlertsController;
  let mockPrisma: any;
  let mockScheduler: any;

  const mockReq = { user: { id: 'user-1' } };

  beforeEach(() => {
    mockPrisma = {
      alert: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'alert-1',
          ...data,
        })),
        findFirst: jest.fn().mockResolvedValue({ id: 'alert-1', status: 'ACTIVE' }),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({
          id: where.id,
          ...data,
        })),
      },
      match: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    mockScheduler = {
      enqueueAlert: jest.fn().mockResolvedValue(1),
      cancelAlertJobs: jest.fn().mockResolvedValue(undefined),
      clearCompletionPrompt: jest.fn().mockResolvedValue(undefined),
      markInitialSearchStarted: jest.fn(),
    };

    controller = new AlertsController(mockPrisma, mockScheduler);
  });

  const buildValidDto = (overrides: Partial<CreateAlertDto> = {}): CreateAlertDto => ({
    originIata: 'MAD',
    destinationIata: 'LON',
    departureDay: 1,
    returnDay: 3,
    adults: 1,
    directOnly: true,
    maxPriceEur: 120,
    startDate: '2026-11-23T00:00:00.000Z',
    endDate: '2026-11-30T23:59:59.999Z',
    ...overrides,
  });

  describe('POST /alerts (create)', () => {
    it('should reject when originIata and destinationIata are the same airport (case-insensitive)', async () => {
      const dto = buildValidDto({ originIata: 'MAD', destinationIata: 'mad' });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(mockScheduler.enqueueAlert).not.toHaveBeenCalled();
    });

    it('should reject when startDate and endDate fall on the same calendar day (e.g. 23/11/2026 -> 23/11/2026)', async () => {
      const dto = buildValidDto({
        departureDay: 1,
        returnDay: 1,
        startDate: '2026-11-23T00:00:00.000Z',
        endDate: '2026-11-23T23:59:59.999Z',
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should reject when startDate is after endDate', async () => {
      const dto = buildValidDto({
        startDate: '2026-11-30T00:00:00.000Z',
        endDate: '2026-11-23T23:59:59.999Z',
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should reject when no valid departure/return date pair fits inside the date range', async () => {
      // 2026-11-23 es lunes y 2026-11-24 es martes; Lunes -> Lunes necesita 7 días (vuelta 2026-11-30 fuera de rango)
      const dto = buildValidDto({
        departureDay: 1,
        returnDay: 1,
        startDate: '2026-11-23T00:00:00.000Z',
        endDate: '2026-11-24T23:59:59.999Z',
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should allow a valid search with distinct airports and valid multi-day date range', async () => {
      const dto = buildValidDto({
        originIata: 'mad',
        destinationIata: 'lon',
        departureDay: 1,
        returnDay: 1,
        startDate: '2026-11-23T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.999Z',
      });

      const created = await controller.create(mockReq, dto);

      expect(created.id).toBe('alert-1');
      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originIata: 'MAD',
            destinationIata: 'LON',
          }),
        }),
      );
      expect(mockScheduler.enqueueAlert).toHaveBeenCalledWith('alert-1');
    });

    it('should allow creating an alert without maxPriceEur (optional / null)', async () => {
      const dto = buildValidDto({ maxPriceEur: undefined });

      const created = await controller.create(mockReq, dto);

      expect(created.id).toBe('alert-1');
      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxPriceEur: null,
          }),
        }),
      );
      expect(mockScheduler.enqueueAlert).toHaveBeenCalledWith('alert-1');
    });
  });

  describe('PATCH /alerts/:id (update)', () => {
    it('should reject updating an alert to the same origin and destination airport', async () => {
      const dto = buildValidDto({ originIata: 'BCN', destinationIata: 'BCN' });

      await expect(controller.update(mockReq, 'alert-1', dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
      expect(mockScheduler.cancelAlertJobs).not.toHaveBeenCalled();
    });

    it('should reject updating an alert to a same-day date range', async () => {
      const dto = buildValidDto({
        startDate: '2026-11-23T00:00:00.000Z',
        endDate: '2026-11-23T23:59:59.999Z',
      });

      await expect(controller.update(mockReq, 'alert-1', dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('should allow clearing maxPriceEur to null on update', async () => {
      const dto = buildValidDto({ maxPriceEur: null });

      await controller.update(mockReq, 'alert-1', dto);

      expect(mockPrisma.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxPriceEur: null,
          }),
        }),
      );
    });
  });

  describe('PATCH /alerts/:id/status (updateStatus)', () => {
    it('should reset matches, mark search in progress, and re-enqueue when reactivating to ACTIVE', async () => {
      const res: any = await controller.updateStatus(mockReq, 'alert-1', { status: 'ACTIVE' as any });

      expect(mockScheduler.clearCompletionPrompt).toHaveBeenCalledWith('alert-1');
      expect(mockScheduler.cancelAlertJobs).toHaveBeenCalledWith('alert-1');
      expect(mockPrisma.match.deleteMany).toHaveBeenCalledWith({ where: { alertId: 'alert-1' } });
      expect(mockScheduler.markInitialSearchStarted).toHaveBeenCalledWith('alert-1');
      expect(mockScheduler.enqueueAlert).toHaveBeenCalledWith('alert-1');
      expect(res.isInitialSearching).toBe(true);
    });
  });

  describe('GET /alerts (findAll reconciliation)', () => {
    it('should reconcile an ACTIVE alert with valid found matches to TRIGGERED when search is not in progress', async () => {
      mockPrisma.alert.findMany = jest.fn().mockResolvedValue([
        {
          id: 'alert-tokio',
          status: 'ACTIVE',
          maxPriceEur: 3000,
          matches: [
            { id: 'm1', foundPriceEur: 2814 },
            { id: 'm2', foundPriceEur: 2814 },
          ],
        },
      ]);
      mockScheduler.hasCompletionPrompt = jest.fn().mockReturnValue(false);
      mockScheduler.isInitialSearchInProgress = jest.fn().mockResolvedValue(false);
      mockScheduler.getSearchScheduleInfo = jest.fn().mockReturnValue({
        cronExpression: '0 */6 * * *',
        intervalLabel: 'cada 6 horas',
        nextSearchAt: '2026-11-23T00:00:00.000Z',
      });

      const alerts: any = await controller.findAll(mockReq);

      expect(alerts[0].status).toBe('TRIGGERED');
      expect(alerts[0].nextSearchAt).toBeNull();
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-tokio' },
        data: { status: 'TRIGGERED' },
      });
    });

    it('should reconcile an ACTIVE alert with maxPriceEur = null and found matches to TRIGGERED', async () => {
      mockPrisma.alert.findMany = jest.fn().mockResolvedValue([
        {
          id: 'alert-no-cap',
          status: 'ACTIVE',
          maxPriceEur: null,
          matches: [{ id: 'm1', foundPriceEur: 499 }],
        },
      ]);
      mockScheduler.hasCompletionPrompt = jest.fn().mockReturnValue(false);
      mockScheduler.isInitialSearchInProgress = jest.fn().mockResolvedValue(false);
      mockScheduler.getSearchScheduleInfo = jest.fn().mockReturnValue({
        cronExpression: '0 */6 * * *',
        intervalLabel: 'cada 6 horas',
        nextSearchAt: '2026-11-23T00:00:00.000Z',
      });

      const alerts: any = await controller.findAll(mockReq);

      expect(alerts[0].status).toBe('TRIGGERED');
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-no-cap' },
        data: { status: 'TRIGGERED' },
      });
    });
  });

  describe('CreateAlertDto (class-validator / ValidationPipe)', () => {
    it('should fail DTO validation when originIata equals destinationIata', async () => {
      const dto = plainToInstance(CreateAlertDto, buildValidDto({ originIata: 'MAD', destinationIata: 'MAD' }));
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('no pueden ser el mismo');
    });

    it('should fail DTO validation when startDate and endDate are on the same calendar day', async () => {
      const dto = plainToInstance(
        CreateAlertDto,
        buildValidDto({
          startDate: '2026-11-23T00:00:00.000Z',
          endDate: '2026-11-23T23:59:59.999Z',
        }),
      );
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('mismo día');
    });

    it('should pass DTO validation for a valid round-trip search', async () => {
      const dto = plainToInstance(CreateAlertDto, buildValidDto());
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass DTO validation when maxPriceEur is omitted or null', async () => {
      const dtoOmitted = plainToInstance(CreateAlertDto, buildValidDto({ maxPriceEur: undefined }));
      expect(await validate(dtoOmitted)).toHaveLength(0);

      const dtoNull = plainToInstance(CreateAlertDto, buildValidDto({ maxPriceEur: null }));
      expect(await validate(dtoNull)).toHaveLength(0);
    });
  });
});
