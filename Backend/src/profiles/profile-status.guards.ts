import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiException } from '../common/api-error';
import {
  PROFILE_STATUS_READER,
  type ProfileStatusReader,
} from './profile-submission.repository';

async function reviewStatusOf(
  reader: ProfileStatusReader,
  context: ExecutionContext,
) {
  const user = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;

  return reader.findReviewStatus(user.sub);
}

/**
 * Discovery and engagement endpoints are only for approved members. The status
 * is read from the server's own record, never from the request.
 */
@Injectable()
export class ApprovedProfileGuard implements CanActivate {
  constructor(
    @Inject(PROFILE_STATUS_READER) private readonly reader: ProfileStatusReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const status = await reviewStatusOf(this.reader, context);

    if (status !== 'approved') {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'PROFILE_NOT_APPROVED',
        'Your profile must be approved before you can use this feature.',
        { status },
      );
    }

    return true;
  }
}

/** A profile under review cannot be edited. */
@Injectable()
export class EditableProfileGuard implements CanActivate {
  constructor(
    @Inject(PROFILE_STATUS_READER) private readonly reader: ProfileStatusReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const status = await reviewStatusOf(this.reader, context);

    if (status === 'submitted') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'PROFILE_LOCKED_IN_REVIEW',
        'Your profile is under review and cannot be edited. Withdraw it to make changes.',
        { status },
      );
    }

    return true;
  }
}
