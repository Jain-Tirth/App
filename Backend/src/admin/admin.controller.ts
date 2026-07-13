import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { RejectProfileDto } from './dto/reject-profile.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('profiles/pending')
  listPendingProfiles() {
    return this.adminService.listPendingProfiles();
  }

  @Get('profiles/:userId')
  getProfileForReview(@Param('userId') userId: string) {
    return this.adminService.getProfileForReview(userId);
  }

  @Patch('profiles/:userId/approve')
  approveProfile(
    @Param('userId') userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.approveProfile(userId, adminUser);
  }

  @Patch('profiles/:userId/reject')
  rejectProfile(
    @Param('userId') userId: string,
    @Body() dto: RejectProfileDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.rejectProfile(userId, dto, adminUser);
  }
}
