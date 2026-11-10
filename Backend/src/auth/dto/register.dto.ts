import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  CONSENT_LANGUAGES,
  type ConsentLanguage,
} from '../../consents/consent.types';

export enum ProfileCreatedBy {
  myself = 'myself',
  son = 'son',
  daughter = 'daughter',
  brother = 'brother',
  sister = 'sister',
  friend = 'friend',
  relative = 'relative',
}

export enum Gender {
  male = 'male',
  female = 'female',
}

export class RegisterConsentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsNotEmpty()
  documentHash!: string;
}

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 20)
  password!: string;

  @IsString()
  @Matches(/^\+\d{1,4}$/)
  countryCode!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsEnum(ProfileCreatedBy)
  profileCreatedBy!: ProfileCreatedBy;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsIn([...CONSENT_LANGUAGES])
  language?: ConsentLanguage;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterConsentDto)
  consents?: RegisterConsentDto[];
}
