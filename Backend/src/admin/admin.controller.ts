import { Controller, Get, Param, Patch, Body, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminService } from './admin.service';
import { RejectProfileDto } from './dto/reject-profile.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @Get('stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @Get('profiles/pending')
  listPendingProfiles() {
    return this.adminService.listPendingProfiles();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @Get('profiles/:userId')
  getProfileForReview(@Param('userId') userId: string) {
    return this.adminService.getProfileForReview(userId);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @Patch('profiles/:userId/approve')
  approveProfile(
    @Param('userId') userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.approveProfile(userId, adminUser);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @Patch('profiles/:userId/reject')
  rejectProfile(
    @Param('userId') userId: string,
    @Body() dto: RejectProfileDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.rejectProfile(userId, dto, adminUser);
  }
}
