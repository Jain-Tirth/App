import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ApiException } from '../../common/api-error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Rejects a malformed `:userId` with a field-level 400 before any lookup. */
@Injectable()
export class UserIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed.',
        {
          issues: ['userId must be a UUID'],
          fields: { userId: 'must be a UUID' },
        },
      );
    }

    return value;
  }
}
