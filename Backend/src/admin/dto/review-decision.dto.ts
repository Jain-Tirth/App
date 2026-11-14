import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { REVIEW_SECTIONS, type ReviewSection } from '../review/review.types';

/**
 * Body of approve, reject and request-changes. Only these keys are accepted
 * (the global pipe forbids the rest), so `accountStatus`, `role` and
 * `idVerified` cannot be sent. The reason code, notes length and the
 * per-decision rules are domain rules checked by `AdminReviewService`.
 */
export class ReviewDecisionDto {
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsIn(REVIEW_SECTIONS, { each: true })
  sections?: ReviewSection[];
}
