import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe — validates all DTOs with class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true,       // Auto-transform payloads to DTO instances
    }),
  );

  // CORS — restrict in production
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? [] : '*',
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Dhobi Matrimony API running on: http://localhost:${port}/api/v1`);
}

bootstrap();
