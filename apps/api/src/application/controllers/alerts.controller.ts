import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAlertDto } from '../../domain/dtos/create-alert.dto';
import { UpdateAlertStatusDto } from '../../domain/dtos/update-alert-status.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { AlertSchedulerService } from '../services/alert-scheduler.service';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertScheduler: AlertSchedulerService,
  ) {}

  @Post()
  async create(@Request() req: any, @Body() createAlertDto: CreateAlertDto) {
    const userId = req.user.id; // Ya viene 100% seguro desde el JWT
    const directOnly = Boolean(createAlertDto.directOnly);

    const alert = await this.prisma.alert.create({
      data: {
        userId,
        originIata: createAlertDto.originIata,
        destinationIata: createAlertDto.destinationIata,
        departureDay: createAlertDto.departureDay,
        returnDay: createAlertDto.returnDay,
        adults: createAlertDto.adults ?? 1,
        maxPriceEur: createAlertDto.maxPriceEur,
        startDate: new Date(createAlertDto.startDate),
        endDate: new Date(createAlertDto.endDate),
      } as any,
    });

    if ((this.prisma as any).$executeRawUnsafe) {
      await (this.prisma as any).$executeRawUnsafe(
        `UPDATE "Alert" SET "directOnly" = $1 WHERE "id" = $2`,
        directOnly,
        alert.id,
      );
    }
    (alert as any).directOnly = directOnly;

    await this.alertScheduler.enqueueAlert(alert.id);
    return alert;
  }

  @Post(':id/check')
  async triggerCheck(@Request() req: any, @Param('id') id: string) {
    const alert = await this.ensureOwnership(id, req.user.id);
    if ((alert as any).status === 'COMPLETED') {
      throw new BadRequestException('Una alerta completada no puede actualizar tarifas.');
    }
    await this.alertScheduler.clearCompletionPrompt(id);
    await this.prisma.match.deleteMany({ where: { alertId: id } });
    await this.prisma.alert.update({
      where: { id },
      data: { status: 'ACTIVE' as any },
    });
    const jobsEnqueued = await this.alertScheduler.enqueueAlert(id);
    return { alertId: id, jobsEnqueued };
  }

  @Get()
  async findAll(@Request() req: any) {
    const userId = req.user.id;
    const alerts = await this.prisma.alert.findMany({
      where: { userId },
      include: { matches: true },
      orderBy: { createdAt: 'desc' },
    });

    if ((this.prisma as any).$queryRawUnsafe && alerts.length > 0) {
      try {
        await (this.prisma as any).$executeRawUnsafe?.(
          `ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "pendingCompletionPrompt" BOOLEAN NOT NULL DEFAULT false`,
        );
        const flags = await (this.prisma as any).$queryRawUnsafe(
          `SELECT "id", "directOnly", "pendingCompletionPrompt" FROM "Alert" WHERE "userId" = $1`,
          userId,
        );
        const flagMap = new Map<string, { directOnly: boolean; pendingCompletionPrompt: boolean }>(
          (flags || []).map((r: any) => [
            r.id,
            {
              directOnly: Boolean(r.directOnly),
              pendingCompletionPrompt: Boolean(r.pendingCompletionPrompt),
            },
          ]),
        );
        for (const a of alerts as any[]) {
          const info = flagMap.get(a.id);
          a.directOnly = info?.directOnly ?? Boolean(a.directOnly);
          a.pendingCompletionPrompt =
            a.status === 'TRIGGERED' &&
            (Boolean(info?.pendingCompletionPrompt) ||
              this.alertScheduler.hasCompletionPrompt(a.id));
        }
      } catch {
        for (const a of alerts as any[]) {
          a.pendingCompletionPrompt =
            a.status === 'TRIGGERED' &&
            this.alertScheduler.hasCompletionPrompt(a.id);
        }
      }
    } else {
      for (const a of alerts as any[]) {
        a.pendingCompletionPrompt =
          a.status === 'TRIGGERED' &&
          this.alertScheduler.hasCompletionPrompt(a.id);
      }
    }

    return alerts;
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateAlertDto: CreateAlertDto) {
    const alert = await this.ensureOwnership(id, req.user.id);
    if ((alert as any).status === 'COMPLETED') {
      throw new BadRequestException('Una alerta completada no puede ser modificada.');
    }
    const directOnly = Boolean(updateAlertDto.directOnly);

    await this.alertScheduler.clearCompletionPrompt(id);
    await this.alertScheduler.cancelAlertJobs(id);
    await this.prisma.match.deleteMany({ where: { alertId: id } });

    const updated = await this.prisma.alert.update({
      where: { id },
      data: {
        originIata: updateAlertDto.originIata,
        destinationIata: updateAlertDto.destinationIata,
        departureDay: updateAlertDto.departureDay,
        returnDay: updateAlertDto.returnDay,
        adults: updateAlertDto.adults ?? 1,
        maxPriceEur: updateAlertDto.maxPriceEur,
        startDate: new Date(updateAlertDto.startDate),
        endDate: new Date(updateAlertDto.endDate),
        status: 'ACTIVE' as any,
      } as any,
    });

    if ((this.prisma as any).$executeRawUnsafe) {
      await (this.prisma as any).$executeRawUnsafe(
        `UPDATE "Alert" SET "directOnly" = $1 WHERE "id" = $2`,
        directOnly,
        id,
      );
    }
    (updated as any).directOnly = directOnly;

    await this.alertScheduler.enqueueAlert(id);
    return updated;
  }

  @Patch(':id/status')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() updateStatusDto: UpdateAlertStatusDto) {
    const alert = await this.ensureOwnership(id, req.user.id);
    if ((alert as any).status === 'COMPLETED') {
      throw new BadRequestException('Una alerta completada no puede volver a activarse.');
    }

    await this.alertScheduler.clearCompletionPrompt(id);

    const updated = await this.prisma.alert.update({
      where: { id },
      data: { status: updateStatusDto.status as any },
    });

    if (updateStatusDto.status !== 'ACTIVE') {
      await this.alertScheduler.cancelAlertJobs(id);
    } else {
      await this.alertScheduler.enqueueAlert(id);
    }

    return updated;
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.ensureOwnership(id, req.user.id);
    await this.alertScheduler.cancelAlertJobs(id);

    return this.prisma.alert.delete({
      where: { id },
    });
  }

  private async ensureOwnership(alertId: string, userId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
      select: { id: true, status: true },
    });
    if (!alert) {
      throw new NotFoundException('Alerta no encontrada o no pertenece al usuario autenticado');
    }
    return alert;
  }
}
