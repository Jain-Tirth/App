import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getClientIp, getUserAgent } from '../common/request-context';
import { ApprovedProfileGuard } from '../profiles/profile-status.guards';
import {
  ClearCooldownDto,
  EmptyBodyDto,
  ListInterestsQueryDto,
  SendInterestDto,
} from './dto/interests.dto';
import { InterestsService } from './interests.service';

@UseGuards(JwtAuthGuard, ApprovedProfileGuard)
@Controller('interests')
export class InterestsController {
  constructor(private readonly interests: InterestsService) {}

  @Post()
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendInterestDto) {
    return this.interests.send(user, dto.receiverProfileRef);
  }

  @Get('sent')
  sent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInterestsQueryDto,
  ) {
    return this.interests.list(user, 'sent', query);
  }

  @Get('received')
  received(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInterestsQueryDto,
  ) {
    return this.interests.list(user, 'received', query);
  }

  @HttpCode(200)
  @Post(':id/accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() _body: EmptyBodyDto,
  ) {
    return this.interests.accept(user, id);
  }

  @HttpCode(200)
  @Post(':id/decline')
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() _body: EmptyBodyDto,
  ) {
    return this.interests.decline(user, id);
  }

  @HttpCode(200)
  @Post(':id/withdraw')
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() _body: EmptyBodyDto,
  ) {
    return this.interests.withdraw(user, id);
  }
}

@Controller('admin/interests')
export class InterestsAdminController {
  constructor(private readonly interests: InterestsService) {}

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  @Post('cooldown/clear')
  clearCooldown(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ClearCooldownDto,
    @Req() request: Request & { requestId?: string },
  ) {
    return this.interests.clearCooldown(admin.sub, dto, {
      requestId: request.requestId ?? '',
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
    });
  }
}
