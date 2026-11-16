import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { StorageModule } from '../storage/storage.module';
import { AccountPurgeService } from './account-purge.service';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import {
  ACCOUNT_CLOCK,
  ACCOUNT_CONFIG,
  ACCOUNT_REPOSITORY,
  PURGE_REPOSITORY,
  STEP_UP_REPOSITORY,
} from './account.types';
import { PostgresAccountRepository } from './postgres-account.repository';
import { PostgresPurgeRepository } from './postgres-purge.repository';
import { PostgresStepUpRepository } from './postgres-step-up.repository';
import { StepUpService } from './step-up.service';

@Module({
  imports: [StorageModule, JwtModule.register({})],
  controllers: [AccountController],
  providers: [
    AccountService,
    AccountPurgeService,
    StepUpService,
    PostgresAccountRepository,
    PostgresStepUpRepository,
    PostgresPurgeRepository,
    { provide: ACCOUNT_REPOSITORY, useExisting: PostgresAccountRepository },
    { provide: STEP_UP_REPOSITORY, useExisting: PostgresStepUpRepository },
    { provide: PURGE_REPOSITORY, useExisting: PostgresPurgeRepository },
    { provide: ACCOUNT_CONFIG, useFactory: () => env.account },
    { provide: ACCOUNT_CLOCK, useValue: () => new Date() },
  ],
  exports: [AccountPurgeService],
})
export class AccountModule {}
