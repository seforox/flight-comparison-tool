import { Controller, Post, Body, Patch, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    const { email, password } = body;
    
    // Hash real de la contraseña usando bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });
    
    // Generar JWT
    const payload = { email: user.email, sub: user.id };
    return { accessToken: this.jwtService.sign(payload) };
  }

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;
    
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Validar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    
    const payload = { email: user.email, sub: user.id };
    return { accessToken: this.jwtService.sign(payload) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('telegram')
  async updateTelegram(@Request() req: any, @Body('telegramChatId') telegramChatId: string) {
    const userId = req.user.id;
    return this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId },
    });
  }
}
