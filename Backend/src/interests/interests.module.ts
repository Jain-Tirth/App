import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { ProfilesModule } from '../profiles/profiles.module';
import { InterestsAdminController, InterestsController } from './interests.controller';
import { InterestsService } from './interests.service';
import {
  INTEREST_AGE_MINIMUMS,
  INTEREST_CLOCK,
  INTEREST_CONFIG,
  INTEREST_REPOSITORY,
} from './interest.types';
import { PostgresInterestsRepository } from './postgres-interests.repository';

@Module({
  imports: [ProfilesModule, JwtModule.register({})],
  controllers: [InterestsController, InterestsAdminController],
  providers: [
    InterestsService,
    PostgresInterestsRepository,
    { provide: INTEREST_REPOSITORY, useExisting: PostgresInterestsRepository },
    { provide: INTEREST_CLOCK, useValue: () => new Date() },
    { provide: INTEREST_CONFIG, useFactory: () => env.interests },
    { provide: INTEREST_AGE_MINIMUMS, useFactory: () => env.ageMinimums },
  ],
})
export class InterestsModule {}
