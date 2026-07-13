import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

/**
 * GET /health — public, unauthenticated liveness/readiness probe for the
 * hosting platform (Railway/Render). Verifies DB connectivity so a deploy that
 * can't reach Postgres is reported unhealthy instead of falsely "live".
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
      });
    }
    return { status: 'ok', db: 'up' };
  }
}
