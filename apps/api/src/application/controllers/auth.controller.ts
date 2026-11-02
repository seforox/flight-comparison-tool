import { Controller, Post, Body, Patch, Request, UnauthorizedException, ConflictException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { TokenBlacklistService } from '../../infrastructure/auth/token-blacklist.service';
import { AuthCredentialsDto, UpdateTelegramDto } from '../../domain/dtos/auth.dto';
import { ExtractJwt } from 'passport-jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  @Post('register')
  async register(@Body() body: AuthCredentialsDto) {
    const { email, password } = body;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    const payload = { email: user.email, sub: user.id };
    return { accessToken: this.jwtService.sign(payload) };
  }

  @Post('login')
  async login(@Body() body: AuthCredentialsDto) {
    const { email, password } = body;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { email: user.email, sub: user.id };
    return { accessToken: this.jwtService.sign(payload) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      await this.tokenBlacklist.blacklistToken(token, req.user?.exp);
    }
    return { message: 'Sesión cerrada correctamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('telegram')
  async updateTelegram(@Request() req: any, @Body() body: UpdateTelegramDto) {
    const userId = req.user.id;
    return this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: body.telegramChatId },
    });
  }
}
