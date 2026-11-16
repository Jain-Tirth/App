import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { ProfilesModule } from '../profiles/profiles.module';
import { PostgresShortlistsRepository } from './postgres-shortlists.repository';
import { ShortlistLimitsService } from './shortlist-limits.service';
import {
  SHORTLIST_AGE_MINIMUMS,
  SHORTLIST_CONFIG,
  SHORTLIST_REPOSITORY,
} from './shortlist.types';
import { ShortlistsController } from './shortlists.controller';
import { ShortlistsService } from './shortlists.service';

@Module({
  imports: [ProfilesModule, JwtModule.register({})],
  controllers: [ShortlistsController],
  providers: [
    ShortlistsService,
    ShortlistLimitsService,
    PostgresShortlistsRepository,
    { provide: SHORTLIST_REPOSITORY, useExisting: PostgresShortlistsRepository },
    { provide: SHORTLIST_CONFIG, useFactory: () => env.shortlists },
    { provide: SHORTLIST_AGE_MINIMUMS, useFactory: () => env.ageMinimums },
  ],
})
export class ShortlistsModule {}
