import { Injectable, PipeTransform } from '@nestjs/common';
import { profileNotFound } from './discovery.errors';

const PROFILE_REF_PATTERN = /^[0-9a-f]{32}$/;

/** A malformed reference answers exactly like an unknown one. */
@Injectable()
export class ProfileRefPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!PROFILE_REF_PATTERN.test(value)) {
      throw profileNotFound();
    }

    return value;
  }
}
