import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Load .env globally across all modules
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Prisma is global — inject PrismaService anywhere without re-importing
    PrismaModule,
  ],
})
export class AppModule {}
