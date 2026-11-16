import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHILE_DELETION_PENDING = 'allowWhileDeletionPending';

/**
 * Marks a route a member may still use while an account deletion is pending
 * (cancelling it, logging out). Every other authenticated route refuses them.
 */
export const AllowWhileDeletionPending = () =>
  SetMetadata(ALLOW_WHILE_DELETION_PENDING, true);
