import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilitar CORS para que el frontend Next.js pueda conectarse
  app.enableCors();
  
  // Activa la validación estricta de DTOs en todos los endpoints
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Elimina campos no definidos en el DTO (anti-inyección)
    forbidNonWhitelisted: true, // Lanza error si envían campos basura
    transform: true, // Convierte payloads a sus tipos correctos automáticamente
  }));

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
