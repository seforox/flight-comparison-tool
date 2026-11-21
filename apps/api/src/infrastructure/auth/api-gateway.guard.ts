import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiGatewayGuard implements CanActivate {
  private readonly logger = new Logger(ApiGatewayGuard.name);

  canActivate(context: ExecutionContext): boolean {
    if (process.env.API_GATEWAY_ENABLED !== 'true') {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();
    const rawPath = String(req.path || req.url || '').split('?')[0];

    // Permitir siempre el healthcheck de Railway y preflight CORS
    if (method === 'OPTIONS' || (method === 'GET' && rawPath === '/health')) {
      return true;
    }

    const expectedSecret = process.env.API_GATEWAY_SECRET;
    if (!expectedSecret) {
      this.logger.error(
        'API_GATEWAY_ENABLED=true pero API_GATEWAY_SECRET no está definido. Bloqueando petición por seguridad.',
      );
      throw new ForbiddenException('Acceso directo no autorizado');
    }

    const headerValue = req.headers?.['x-api-gateway-secret'];
    const providedSecret = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!providedSecret || !this.safeCompare(String(providedSecret), expectedSecret)) {
      throw new ForbiddenException('Acceso directo a la API no permitido');
    }

    return true;
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
