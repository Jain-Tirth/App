import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { RequestIdInterceptor } from './common/request-id.interceptor';
import { ConsentsModule } from './consents/consents.module';
import { DatabaseModule } from './database/database.module';
import { InterestsModule } from './interests/interests.module';
import { KycModule } from './kyc/kyc.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ShortlistsModule } from './shortlists/shortlists.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    ConsentsModule,
    DatabaseModule,
    InterestsModule,
    KycModule,
    ProfilesModule,
    ShortlistsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
  ],
})
export class AppModule { }
