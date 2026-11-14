import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { ConsentsModule } from '../consents/consents.module';
import { ConsentsService } from '../consents/consents.service';
import { StorageModule } from '../storage/storage.module';
import { AesGcmIdNumberCipher, ID_NUMBER_CIPHER } from './id-number.cipher';
import { KycController } from './kyc.controller';
import { KYC_PROVIDER, ManualKycProvider } from './kyc.provider';
import { KYC_REPOSITORY } from './kyc.repository';
import { KYC_CLOCK, KYC_CONSENT_GATE, KycService } from './kyc.service';
import { PostgresKycRepository } from './postgres-kyc.repository';

@Module({
  imports: [ConsentsModule, StorageModule],
  controllers: [KycController],
  providers: [
    KycService,
    { provide: KYC_REPOSITORY, useClass: PostgresKycRepository },
    { provide: KYC_PROVIDER, useFactory: () => new ManualKycProvider() },
    {
      provide: ID_NUMBER_CIPHER,
      useFactory: () => new AesGcmIdNumberCipher(env.kycEncryptionKey),
    },
    { provide: KYC_CONSENT_GATE, useExisting: ConsentsService },
    { provide: KYC_CLOCK, useValue: () => new Date() },
  ],
})
export class KycModule {}
