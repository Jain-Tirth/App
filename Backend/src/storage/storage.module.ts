import { Module } from '@nestjs/common';
import { env } from '../config/env';
import { FakeStorageProvider } from './fake-storage.provider';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage';
import { S3StorageProvider } from './s3-storage.provider';

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

/** One object store instance shared by every module that signs file URLs. */
@Module({
  providers: [{ provide: OBJECT_STORAGE, useFactory: createStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
