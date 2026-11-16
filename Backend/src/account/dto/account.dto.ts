import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LANGUAGES, PROFILE_VISIBILITIES } from '../account.types';

export class NotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  interestReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  interestAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  profileApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  newMessage?: boolean;

  @IsOptional()
  @IsBoolean()
  profileViewed?: boolean;
}

/** Body of PATCH /account/settings. Only these keys are accepted (SEC-13). */
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: (typeof LANGUAGES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;

  @IsOptional()
  @IsIn(PROFILE_VISIBILITIES)
  profileVisibility?: (typeof PROFILE_VISIBILITIES)[number];
}

/** Body of the export and delete requests: the member's password, nothing else. */
export class StepUpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

/** Body of calls that take none; any field is rejected. */
export class EmptyBodyDto {
  @IsOptional()
  @IsEmpty()
  _none?: never;
}
