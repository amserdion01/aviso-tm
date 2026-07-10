import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Real auth signs JWTs with this secret — refuse to boot without one.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET lipsește din environment (vezi api/.env.example).',
    );
  }

  const app = await NestFactory.create(AppModule);

  // Faked auth means no sessions; just allow the Angular dev origin.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Aviso TM API listening on http://localhost:${port}`);
}

void bootstrap();
