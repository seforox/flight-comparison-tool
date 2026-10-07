import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { CreateAlertDto } from '../../domain/dtos/create-alert.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Request() req: any, @Body() createAlertDto: CreateAlertDto) {
    const userId = req.user.id; // Ya viene 100% seguro desde el JWT

    return this.prisma.alert.create({
      data: {
        userId,
        originIata: createAlertDto.originIata,
        destinationIata: createAlertDto.destinationIata,
        departureDay: createAlertDto.departureDay,
        returnDay: createAlertDto.returnDay,
        maxPriceEur: createAlertDto.maxPriceEur,
        startDate: new Date(createAlertDto.startDate),
        endDate: new Date(createAlertDto.endDate),
      },
    });
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
  async updateStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'PAUSED') {
    return this.prisma.alert.update({
      where: { id },
      data: { status },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.alert.delete({
      where: { id },
    });
  }
}
