import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminService } from './admin.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtStrategy],
})
export class AdminModule {}
