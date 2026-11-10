import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  console.time('[PERF] NestJSFactory.create');
  const app = await NestFactory.create(AppModule);
  console.timeEnd('[PERF] NestFactory.create');
  
  // Global validation pipe — validates all DTOs with class-validator
  console.time('[PERF] Global validation pipeline');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true,       // Auto-transform payloads to DTO instances
    }),
  );
  console.timeEnd('[PERF] Global validation pipeline');


   console.time('[PERF] CORS setup');
   // CORS — restrict in production
   app.enableCors({
     origin: process.env.NODE_ENV === 'production' ? [] : '*',
    credentials: true,
  });
  console.timeEnd('[PERF] CORS setup');
 
  console.time('[PERF] API module setup');
  // Global API prefix
  app.setGlobalPrefix('api/v1');
  console.timeEnd('[PERF] API module setup');

  console.time('[PERF] app.listen');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.timeEnd('[PERF] app.listen');
  console.log(`🚀 Dhobi Matrimony API running on: http://localhost:${port}/api/v1`);
}

bootstrap();
