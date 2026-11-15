import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp, getUserAgent } from '../common/request-context';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ReopenProfileDto } from './dto/reopen-profile.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { AdminService } from './admin.service';
import { AdminReviewService } from './review/review.service';
import type { AuditContext, ReviewDecision } from './review/review.types';
import { UserIdPipe } from './review/user-id.pipe';

function auditContext(request: Request & { requestId?: string }): AuditContext {
  return {
    requestId: request.requestId ?? '',
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
  };
}

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly reviewService: AdminReviewService,
  ) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('profiles/pending')
  listPendingProfiles() {
    return this.reviewService.listQueue();
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('profiles/:userId')
  getProfileForReview(@Param('userId', UserIdPipe) userId: string) {
    return this.reviewService.getWorkspace(userId);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('profiles/:userId/id-document')
  openIdDocument(
    @Param('userId', UserIdPipe) userId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reviewService.openIdDocument(
      userId,
      adminUser.sub,
      auditContext(request),
    );
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('profiles/:userId/approve')
  approveProfile(
    @Param('userId', UserIdPipe) userId: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() adminUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.decide('approve', userId, dto, adminUser, request);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('profiles/:userId/reject')
  rejectProfile(
    @Param('userId', UserIdPipe) userId: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() adminUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.decide('reject', userId, dto, adminUser, request);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('profiles/:userId/request-changes')
  requestChanges(
    @Param('userId', UserIdPipe) userId: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() adminUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.decide('requestChanges', userId, dto, adminUser, request);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  @Post('profiles/:userId/reopen')
  reopenProfile(
    @Param('userId', UserIdPipe) userId: string,
    @Body() dto: ReopenProfileDto,
    @CurrentUser() adminUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.decide('reopen', userId, dto, adminUser, request);
  }

  private decide(
    decision: ReviewDecision,
    userId: string,
    dto: ReviewDecisionDto | ReopenProfileDto,
    adminUser: AuthenticatedUser,
    request: Request,
  ) {
    return this.reviewService.decide(
      decision,
      userId,
      adminUser.sub,
      dto,
      auditContext(request),
    );
  }
}
