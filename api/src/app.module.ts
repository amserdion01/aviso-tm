import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReferateModule } from './referate/referate.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Generous global rate-limit as a safety net for the public demo; the login
    // route tightens this further (see @Throttle in AuthController).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReferateModule,
    WorkflowsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
