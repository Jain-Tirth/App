import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { accountDeletionPending } from '../../account/account.errors';
import type { AuthenticatedUser } from '../auth.types';
import { ALLOW_WHILE_DELETION_PENDING } from '../decorators/allow-while-deletion-pending.decorator';

/**
 * Authenticates the member. A member with a pending account deletion is
 * authenticated but may only use routes marked `@AllowWhileDeletionPending()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: any,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const member = super.handleRequest(err, user, info, context, status) as AuthenticatedUser;

    if (member.deletionScheduledPurgeAt) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_WHILE_DELETION_PENDING,
        [context.getHandler(), context.getClass()],
      );

      if (!allowed) {
        throw accountDeletionPending(member.deletionScheduledPurgeAt);
      }
    }

    return member as TUser;
  }
}
