import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../common/api-error';
import {
  REVIEW_REASON_CODES,
  type ReviewDecision,
  type ReviewReasonCode,
} from './review.types';

/** Problems an editing member cannot fix, so "request changes" never offers them. */
const NOT_FIXABLE: readonly ReviewReasonCode[] = ['under-age', 'duplicate-account'];

export function allowedReasonCodes(decision: ReviewDecision): ReviewReasonCode[] {
  return decision === 'requestChanges'
    ? REVIEW_REASON_CODES.filter((code) => !NOT_FIXABLE.includes(code))
    : [...REVIEW_REASON_CODES];
}

/**
 * Validates a decision's reason code. Approve may omit it; reject and request
 * changes require one. Returns the code (or null when approve omits it).
 */
export function validateReasonCode(
  decision: ReviewDecision,
  value: unknown,
): ReviewReasonCode | null {
  const allowed = allowedReasonCodes(decision);

  if (value === undefined || value === null || value === '') {
    if (decision === 'approve') {
      return null;
    }
  } else if (
    typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
  ) {
    return value as ReviewReasonCode;
  }

  throw new ApiException(
    HttpStatus.BAD_REQUEST,
    'INVALID_REASON_CODE',
    'The reason code is missing or not allowed for this decision.',
    { allowed },
  );
}
