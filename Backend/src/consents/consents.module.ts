import { Module } from '@nestjs/common';
import { CONSENT_REPOSITORY } from './consent.repository';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { PostgresConsentRepository } from './postgres-consent.repository';

@Module({
  controllers: [ConsentsController],
  providers: [
    ConsentsService,
    {
      provide: CONSENT_REPOSITORY,
      useClass: PostgresConsentRepository,
    },
  ],
  exports: [ConsentsService],
})
export class ConsentsModule {}
