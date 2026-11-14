import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { resolveResponseLanguage } from '../consents/consent.domain';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import { getRequestedLanguage } from '../common/request-context';
import { CompleteUploadDto, EmptyBodyDto, UploadUrlDto } from './dto/kyc.dto';
import { KycService } from './kyc.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('kyc/verification')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() _body: EmptyBodyDto,
    @Req() request: Request,
  ) {
    return this.kycService.createVerification(
      user.sub,
      resolveResponseLanguage(getRequestedLanguage(request)),
    );
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getVerification(user.sub);
  }

  @Post('uploads')
  requestUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadUrlDto,
  ) {
    return this.kycService.requestUpload(user.sub, dto);
  }

  @Post('uploads/:mediaId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.kycService.completeUpload(user.sub, mediaId, dto.checksum);
  }

  @Delete('uploads/:mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<void> {
    await this.kycService.discardPendingUpload(user.sub, mediaId);
  }

  @Get('media/:mediaId/url')
  async readUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    const signed = await this.kycService.getMediaReadUrl(user.sub, mediaId);

    return { url: signed.url, expiresAt: signed.expiresAt };
  }

  @Post('restart')
  @HttpCode(HttpStatus.OK)
  restart(
    @CurrentUser() user: AuthenticatedUser,
    @Body() _body: EmptyBodyDto,
  ) {
    return this.kycService.restart(user.sub);
  }
}
