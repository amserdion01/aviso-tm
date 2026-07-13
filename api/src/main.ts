import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Real auth signs JWTs with this secret — refuse to boot without one.
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET lipsește din environment (vezi api/.env.example).',
    );
  }

  const app = await NestFactory.create(AppModule);

  // Security headers for the public deploy; drop the Express fingerprint.
  app.use(helmet());
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // The API and the SPA are separate origins; allow only the configured one.
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
