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

  const formatIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

  const getFutureMonday = (minDaysAhead = 7): Date => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + minDaysAhead);
    while (d.getUTCDay() !== 1) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  };

  const addUtcDays = (base: Date, days: number): Date => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };

  const todayIso = () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return formatIsoDate(d);
  };

  const yesterdayIso = () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - 1);
    return formatIsoDate(d);
  };

  const buildValidDto = (overrides: Partial<CreateAlertDto> = {}): CreateAlertDto => {
    const monday = getFutureMonday();
    const nextMonday = addUtcDays(monday, 7);
    return {
      originIata: 'MAD',
      destinationIata: 'LON',
      departureDay: 1,
      returnDay: 3,
      adults: 1,
      directOnly: true,
      maxPriceEur: 120,
      startDate: `${formatIsoDate(monday)}T00:00:00.000Z`,
      endDate: `${formatIsoDate(nextMonday)}T23:59:59.999Z`,
      ...overrides,
    };
  };

  describe('POST /alerts (create)', () => {
    it('should reject when startDate is before the current day (yesterday)', async () => {
      const futureEnd = addUtcDays(getFutureMonday(), 7);
      const dto = buildValidDto({
        startDate: `${yesterdayIso()}T00:00:00.000Z`,
        endDate: `${formatIsoDate(futureEnd)}T23:59:59.999Z`,
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(mockScheduler.enqueueAlert).not.toHaveBeenCalled();
    });

    it('should allow when startDate is today and a valid future tuple fits in range', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const end = addUtcDays(today, 14);
      const dto = buildValidDto({
        startDate: `${todayIso()}T00:00:00.000Z`,
        endDate: `${formatIsoDate(end)}T23:59:59.999Z`,
      });

      const created = await controller.create(mockReq, dto);
      expect(created.id).toBe('alert-1');
      expect(mockPrisma.alert.create).toHaveBeenCalled();
    });

    it('should reject when originIata and destinationIata are the same airport (case-insensitive)', async () => {
      const dto = buildValidDto({ originIata: 'MAD', destinationIata: 'mad' });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(mockScheduler.enqueueAlert).not.toHaveBeenCalled();
    });

    it('should reject when startDate and endDate fall on the same calendar day', async () => {
      const monday = formatIsoDate(getFutureMonday());
      const dto = buildValidDto({
        departureDay: 1,
        returnDay: 1,
        startDate: `${monday}T00:00:00.000Z`,
        endDate: `${monday}T23:59:59.999Z`,
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should reject when startDate is after endDate', async () => {
      const monday = getFutureMonday();
      const nextMonday = addUtcDays(monday, 7);
      const dto = buildValidDto({
        startDate: `${formatIsoDate(nextMonday)}T00:00:00.000Z`,
        endDate: `${formatIsoDate(monday)}T23:59:59.999Z`,
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should reject when no valid departure/return date pair fits inside the date range', async () => {
      // Lunes -> Lunes necesita 7 días; un rango de Lunes a Martes no contiene vuelta válida
      const monday = getFutureMonday();
      const tuesday = addUtcDays(monday, 1);
      const dto = buildValidDto({
        departureDay: 1,
        returnDay: 1,
        startDate: `${formatIsoDate(monday)}T00:00:00.000Z`,
        endDate: `${formatIsoDate(tuesday)}T23:59:59.999Z`,
      });

      await expect(controller.create(mockReq, dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('should allow a valid search with distinct airports and valid multi-day date range', async () => {
      const monday = getFutureMonday();
      const nextMonday = addUtcDays(monday, 7);
      const dto = buildValidDto({
        originIata: 'mad',
        destinationIata: 'lon',
        departureDay: 1,
        returnDay: 1,
        startDate: `${formatIsoDate(monday)}T00:00:00.000Z`,
        endDate: `${formatIsoDate(nextMonday)}T23:59:59.999Z`,
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
      const monday = formatIsoDate(getFutureMonday());
      const dto = buildValidDto({
        startDate: `${monday}T00:00:00.000Z`,
        endDate: `${monday}T23:59:59.999Z`,
      });

      await expect(controller.update(mockReq, 'alert-1', dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('should reject updating an alert to a startDate before today', async () => {
      const futureEnd = addUtcDays(getFutureMonday(), 7);
      const dto = buildValidDto({
        startDate: `${yesterdayIso()}T00:00:00.000Z`,
        endDate: `${formatIsoDate(futureEnd)}T23:59:59.999Z`,
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

    it('should fail DTO validation when startDate is earlier than today', async () => {
      const dto = plainToInstance(
        CreateAlertDto,
        buildValidDto({
          startDate: `${yesterdayIso()}T00:00:00.000Z`,
        }),
      );
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('anterior al día actual');
    });

    it('should fail DTO validation when startDate and endDate are on the same calendar day', async () => {
      const monday = formatIsoDate(getFutureMonday());
      const dto = plainToInstance(
        CreateAlertDto,
        buildValidDto({
          startDate: `${monday}T00:00:00.000Z`,
          endDate: `${monday}T23:59:59.999Z`,
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
