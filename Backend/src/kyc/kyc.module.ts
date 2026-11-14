import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { ConsentsModule } from '../consents/consents.module';
import { ConsentsService } from '../consents/consents.service';
import { FakeStorageProvider } from '../storage/fake-storage.provider';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';
import { S3StorageProvider } from '../storage/s3-storage.provider';
import { AesGcmIdNumberCipher, ID_NUMBER_CIPHER } from './id-number.cipher';
import { KycController } from './kyc.controller';
import { KYC_PROVIDER, ManualKycProvider } from './kyc.provider';
import { KYC_REPOSITORY } from './kyc.repository';
import { KYC_CLOCK, KYC_CONSENT_GATE, KycService } from './kyc.service';
import { PostgresKycRepository } from './postgres-kyc.repository';

function createStorage(): ObjectStorage {
  const storage = env.storage;

  return storage.provider === 'fake'
    ? new FakeStorageProvider()
    : new S3StorageProvider({
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
        region: storage.region,
        bucket: storage.bucket,
        endpoint: storage.endpoint,
      });
}

@Module({
  imports: [ConsentsModule],
  controllers: [KycController],
  providers: [
    KycService,
    { provide: KYC_REPOSITORY, useClass: PostgresKycRepository },
    { provide: KYC_PROVIDER, useFactory: () => new ManualKycProvider() },
    { provide: OBJECT_STORAGE, useFactory: createStorage },
    {
      provide: ID_NUMBER_CIPHER,
      useFactory: () => new AesGcmIdNumberCipher(env.kycEncryptionKey),
    },
    { provide: KYC_CONSENT_GATE, useExisting: ConsentsService },
    { provide: KYC_CLOCK, useValue: () => new Date() },
  ],
})
export class KycModule {}
