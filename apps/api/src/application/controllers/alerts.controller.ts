import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
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

    await this.alertScheduler.enqueueAlert(alert.id);
    return alert;
  }

  @Post(':id/check')
  async triggerCheck(@Param('id') id: string) {
    const jobsEnqueued = await this.alertScheduler.enqueueAlert(id);
    return { alertId: id, jobsEnqueued };
  }

  @Get()
  async findAll(@Request() req: any) {
    const userId = req.user.id;
    return this.prisma.alert.findMany({
      where: { userId },
      include: { matches: true }, // Incluir las coincidencias como indica el SPEC
    });
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateAlertStatusDto) {
    return this.prisma.alert.update({
      where: { id },
      data: { status: updateStatusDto.status as any },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.alert.delete({
      where: { id },
    });
  }
}
