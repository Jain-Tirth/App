import { hasErrorCode } from '../apiError';

export type CancelFailureAction = 'logout' | 'recheck' | 'show-error';

/**
 * Decides what the deleted-pending screen does when cancelling the deletion fails.
 * A 404 DELETE_REQUEST_NOT_FOUND means nothing is pending any more, so the app
 * re-checks the account instead of showing an error.
 */
export function decideCancelFailure(err: unknown): CancelFailureAction {
  if (hasErrorCode(err, 'UNAUTHORIZED')) return 'logout';
  if (hasErrorCode(err, 'DELETE_REQUEST_NOT_FOUND')) return 'recheck';
  return 'show-error';
}
