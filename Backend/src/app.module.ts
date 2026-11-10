import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { RequestIdInterceptor } from './common/request-id.interceptor';
import { ConsentsModule } from './consents/consents.module';
import { DatabaseModule } from './database/database.module';
import { ProfilesModule } from './profiles/profiles.module';

@Module({
  imports: [
    AdminModule,
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ConsentsModule,
    DatabaseModule,
    ProfilesModule,
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
