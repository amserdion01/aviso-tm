import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ReferateModule } from './referate/referate.module';

@Module({
  imports: [PrismaModule, UsersModule, ReferateModule],
})
export class AppModule {}
