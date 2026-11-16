import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards, NotFoundException } from '@nestjs/common';
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
    await this.ensureOwnership(id, req.user.id);
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
        const flags = await (this.prisma as any).$queryRawUnsafe(
          `SELECT "id", "directOnly" FROM "Alert" WHERE "userId" = $1`,
          userId,
        );
        const flagMap = new Map<string, boolean>(
          (flags || []).map((r: any) => [r.id, Boolean(r.directOnly)]),
        );
        for (const a of alerts as any[]) {
          a.directOnly = flagMap.get(a.id) ?? Boolean(a.directOnly);
        }
      } catch {
        // ignore if column not yet queried
      }
    }

    return alerts;
  }

  @Patch(':id/status')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() updateStatusDto: UpdateAlertStatusDto) {
    await this.ensureOwnership(id, req.user.id);

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

  private async ensureOwnership(alertId: string, userId: string): Promise<void> {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, userId },
      select: { id: true },
    });
    if (!alert) {
      throw new NotFoundException('Alerta no encontrada o no pertenece al usuario autenticado');
    }
  }
}
