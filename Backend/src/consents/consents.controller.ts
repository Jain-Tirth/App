import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  getClientIp,
  getRequestedLanguage,
  getUserAgent,
} from '../common/request-context';
import { ConsentsService } from './consents.service';
import { GetCurrentConsentsQueryDto } from './dto/get-current-consents.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { RenewConsentDto } from './dto/renew-consent.dto';

@UseGuards(JwtAuthGuard)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get('current')
  getCurrentConsents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetCurrentConsentsQueryDto,
    @Req() request: Request,
  ) {
    return this.consentsService.getCurrentConsents(
      user.sub,
      getRequestedLanguage(request, query.language),
    );
  }

  @Get()
  getConsentHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.consentsService.getConsentHistory(user.sub);
  }

  @Post()
  recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordConsentDto,
    @Req() request: Request,
  ) {
    return this.consentsService.recordConsent(
      user.sub,
      {
        code: dto.code,
        version: dto.version,
        documentHash: dto.documentHash,
      },
      {
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
        language: getRequestedLanguage(request, dto.language),
        source: 'api',
      },
    );
  }

  @Post('renew')
  renewConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RenewConsentDto,
    @Req() request: Request,
  ) {
    return this.consentsService.renewConsent(
      user.sub,
      {
        code: dto.code,
        version: dto.version,
        documentHash: dto.documentHash,
      },
      {
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
        language: getRequestedLanguage(request, dto.language),
      },
    );
  }
}
