import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  CONSENT_LANGUAGES,
  type ConsentLanguage,
} from '../consent.types';

export class RecordConsentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  documentHash!: string;

  @IsOptional()
  @IsIn([...CONSENT_LANGUAGES])
  language?: ConsentLanguage;
}
