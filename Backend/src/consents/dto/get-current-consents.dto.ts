import { IsIn, IsOptional } from 'class-validator';
import {
  CONSENT_LANGUAGES,
  type ConsentLanguage,
} from '../consent.types';

export class GetCurrentConsentsQueryDto {
  @IsOptional()
  @IsIn([...CONSENT_LANGUAGES])
  language?: ConsentLanguage;
}
