import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { getRequestedLanguage } from '../common/request-context';
import { ConsentsService } from './consents.service';
import { ConsentLanguageQueryDto } from './dto/consent-language-query.dto';

/**
 * The public consent surface. Registration is the first consent moment and
 * happens before a member has a token, so a registration client must be able to
 * fetch the active documents (code, version and hash) without authentication.
 *
 * This controller deliberately has no `@UseGuards`: there is no global guard in
 * this application, so every route declared here is public. It is kept separate
 * from `ConsentsController` so the member endpoints stay protected by their
 * class-level `JwtAuthGuard`.
 */
@Controller('consents')
export class ConsentDocumentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get('documents')
  getActiveDocuments(
    @Query() query: ConsentLanguageQueryDto,
    @Req() request: Request,
  ) {
    return this.consentsService.getActiveConsentDocuments(
      getRequestedLanguage(request, query.language),
    );
  }
}
