import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AllowWhileDeletionPending } from '../auth/decorators/allow-while-deletion-pending.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import { getClientIp, getUserAgent } from '../common/request-context';
import { AccountService } from './account.service';
import type { AuditContext } from './account.types';
import { EmptyBodyDto, StepUpDto, UpdateSettingsDto } from './dto/account.dto';

/** A transformed DTO carries every declared key; keep only those the client sent. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function auditContext(request: Request): AuditContext {
  return { ip: getClientIp(request), userAgent: getUserAgent(request) };
}

/** Every route acts on the member in the token; no id is taken from the URL. */
@UseGuards(JwtAuthGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('settings')
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.account.getSettings(user.sub);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.account.updateSettings(user.sub, {
      language: dto.language,
      profileVisibility: dto.profileVisibility,
      notifications: dto.notifications
        ? definedOnly(dto.notifications)
        : undefined,
    });
  }

  @HttpCode(200)
  @Post('logout-all')
  logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() _body: EmptyBodyDto,
    @Req() request: Request,
  ) {
    return this.account.logoutAll(user.sub, auditContext(request));
  }

  @HttpCode(202)
  @Post('export-request')
  requestExport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StepUpDto,
    @Req() request: Request,
  ) {
    return this.account.requestExport(user.sub, dto.password, auditContext(request));
  }

  @Get('export/:requestId')
  downloadExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Req() request: Request,
  ) {
    return this.account.downloadExport(user.sub, requestId, auditContext(request));
  }

  @HttpCode(202)
  @Post('delete-request')
  requestDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StepUpDto,
    @Req() request: Request,
  ) {
    return this.account.requestDeletion(user.sub, dto.password, auditContext(request));
  }

  @AllowWhileDeletionPending()
  @Delete('delete-request')
  cancelDeletion(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.account.cancelDeletion(user.sub, auditContext(request));
  }
}
