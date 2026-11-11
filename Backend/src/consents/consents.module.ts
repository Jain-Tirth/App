import { Module } from '@nestjs/common';
import { CONSENT_REPOSITORY } from './consent.repository';
import { ConsentDocumentsController } from './consent-documents.controller';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { PostgresConsentRepository } from './postgres-consent.repository';

@Module({
  controllers: [ConsentsController, ConsentDocumentsController],
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
