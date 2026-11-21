import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilitar CORS (en producción restringir con CORS_ORIGIN separando múltiples dominios por coma)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : null;

  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  
  // Activa la validación estricta de DTOs en todos los endpoints
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Elimina campos no definidos en el DTO (anti-inyección)
    forbidNonWhitelisted: true, // Lanza error si envían campos basura
    transform: true, // Convierte payloads a sus tipos correctos automáticamente
  }));

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
