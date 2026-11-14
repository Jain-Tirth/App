import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { StorageModule } from '../storage/storage.module';
import { AdminController } from './admin.controller';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminService } from './admin.service';
import { PostgresReviewRepository } from './review/postgres-review.repository';
import { REVIEW_CLOCK, REVIEW_REPOSITORY } from './review/review.repository';
import {
  AdminReviewService,
  REVIEW_AGE_MINIMUMS,
  REVIEW_BUSINESS_HOURS,
} from './review/review.service';

@Module({
  imports: [JwtModule.register({}), StorageModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminJwtStrategy,
    AdminReviewService,
    { provide: REVIEW_REPOSITORY, useClass: PostgresReviewRepository },
    { provide: REVIEW_CLOCK, useValue: () => new Date() },
    { provide: REVIEW_BUSINESS_HOURS, useFactory: () => env.review },
    { provide: REVIEW_AGE_MINIMUMS, useFactory: () => env.ageMinimums },
  ],
})
export class AdminModule {}
