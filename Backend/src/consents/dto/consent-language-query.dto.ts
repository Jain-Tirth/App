import { IsIn, IsOptional } from 'class-validator';
import { CONSENT_LANGUAGES, type ConsentLanguage } from '../consent.types';

/**
 * The `language` query parameter shared by every endpoint that serves consent
 * text. An explicit value is a validated instruction; an unsupported value is
 * a 400 rather than a silent fallback.
 */
export class ConsentLanguageQueryDto {
  @IsOptional()
  @IsIn([...CONSENT_LANGUAGES])
  language?: ConsentLanguage;
}
