import { Type } from 'class-transformer';
import {
  IsEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { INTEREST_STATUSES, MAX_INTEREST_PAGE_SIZE } from '../interest.types';

/** Body of `POST /interests`. Only the receiver reference is accepted. */
export class SendInterestDto {
  @IsString()
  @MaxLength(64)
  receiverProfileRef!: string;
}

/**
 * Body of accept, decline and withdraw: none. Declaring one always-empty
 * property lets the global pipe reject `status`, `senderId`, `respondedAt`
 * and `canChat` (400) while an absent body still passes.
 */
export class EmptyBodyDto {
  @IsOptional()
  @IsEmpty()
  _none?: never;
}

export class ListInterestsQueryDto {
  @IsOptional()
  @IsIn(INTEREST_STATUSES)
  status?: (typeof INTEREST_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INTEREST_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  cursor?: string;
}

/** Body of `POST /admin/interests/cooldown/clear`. */
export class ClearCooldownDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  senderProfileUid!: string;

  @IsString()
  @MaxLength(64)
  receiverProfileRef!: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
