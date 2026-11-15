import { IsOptional, IsString } from 'class-validator';

/**
 * Body of reopen. Only these keys are accepted (the global pipe forbids the
 * rest), so `status`, `accountStatus`, `profileReviewStatus` and `adminId`
 * cannot be sent. The reason code is a domain rule checked by `AdminReviewService`.
 */
export class ReopenProfileDto {
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
