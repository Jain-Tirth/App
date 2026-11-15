import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';

/**
 * Keyset position of the last item on a page. `createdAt` is the profile
 * creation time as UTC text with microseconds (what the database stores), and
 * `profileRef` breaks ties. Neither value is an internal id.
 */
export interface SearchPosition {
  createdAt: string;
  profileRef: string;
}

const CREATED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
const PROFILE_REF_PATTERN = /^[0-9a-f]{32}$/;

export function encodeCursor(position: SearchPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.createdAt, r: position.profileRef }),
  ).toString('base64url');
}

function invalidCursor(): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'INVALID_CURSOR',
    'The cursor is not valid. Start again from the first page.',
    { field: 'cursor' },
  );
}

export function decodeCursor(raw: string): SearchPosition {
  const bytes = Buffer.from(raw, 'base64url');

  // Buffer decoding ignores stray characters; a genuine cursor re-encodes to
  // exactly the text that was sent.
  if (bytes.toString('base64url') !== raw) {
    throw invalidCursor();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw invalidCursor();
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw invalidCursor();
  }

  const { t, r } = parsed as { t?: unknown; r?: unknown };

  if (
    typeof t !== 'string' ||
    typeof r !== 'string' ||
    !CREATED_AT_PATTERN.test(t) ||
    !PROFILE_REF_PATTERN.test(r) ||
    Number.isNaN(Date.parse(`${t.slice(0, 19)}Z`))
  ) {
    throw invalidCursor();
  }

  return { createdAt: t, profileRef: r };
}
