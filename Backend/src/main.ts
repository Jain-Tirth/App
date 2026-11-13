import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env, validateEnv } from './config/env';

async function bootstrap() {
  validateEnv();

  console.time('[PERF] NestFactory.create');
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
     origin: env.isProduction ? [] : '*',
    credentials: true,
  });
  console.timeEnd('[PERF] CORS setup');
 
  console.time('[PERF] API module setup');
  // Global API prefix
  app.setGlobalPrefix('api/v1');
  console.timeEnd('[PERF] API module setup');

  console.time('[PERF] app.listen');
  const port = env.port;
  await app.listen(port);
  console.timeEnd('[PERF] app.listen');
  console.log(
    `Dhobi Matrimony API running on: http://localhost:${port}/api/v1 ` +
      `(NODE_ENV=${env.nodeEnv}, env file=${env.envFile})`,
  );
}

bootstrap();
