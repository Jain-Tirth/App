import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { ConsentsModule } from '../consents/consents.module';
import { ConsentsService } from '../consents/consents.service';
import {
  ApprovedProfileGuard,
  EditableProfileGuard,
} from './profile-status.guards';
import {
  PROFILE_STATUS_READER,
  PROFILE_SUBMISSION_REPOSITORY,
} from './profile-submission.repository';
import {
  ProfileSubmissionService,
  SUBMISSION_AGE_MINIMUMS,
  SUBMISSION_CLOCK,
  SUBMISSION_CONSENT_GATE,
} from './profile-submission.service';
import { PostgresProfileSubmissionRepository } from './postgres-profile-submission.repository';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [ConsentsModule],
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    ProfileSubmissionService,
    ApprovedProfileGuard,
    EditableProfileGuard,
    PostgresProfileSubmissionRepository,
    {
      provide: PROFILE_SUBMISSION_REPOSITORY,
      useExisting: PostgresProfileSubmissionRepository,
    },
    {
      provide: PROFILE_STATUS_READER,
      useExisting: PostgresProfileSubmissionRepository,
    },
    { provide: SUBMISSION_CONSENT_GATE, useExisting: ConsentsService },
    { provide: SUBMISSION_CLOCK, useValue: () => new Date() },
    { provide: SUBMISSION_AGE_MINIMUMS, useFactory: () => env.ageMinimums },
  ],
})
export class ProfilesModule {}
