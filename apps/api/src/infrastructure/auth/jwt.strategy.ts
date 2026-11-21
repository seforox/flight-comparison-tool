import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly tokenBlacklist: TokenBlacklistService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret_dont_use_in_prod',
      passReqToCallback: true,
    });
  }

  // Se ejecuta automáticamente si la firma del token es válida
  async validate(req: any, payload: any) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token && (await this.tokenBlacklist.isBlacklisted(token))) {
      throw new UnauthorizedException('La sesión ha sido cerrada (token revocado)');
    }

    return { id: payload.sub, email: payload.email, exp: payload.exp };
  }
}
