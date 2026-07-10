import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReferateModule } from './referate/referate.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ReferateModule, WorkflowsModule],
})
export class AppModule {}
