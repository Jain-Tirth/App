import { invalidInterestCursor } from './interest.errors';
import type { InterestPosition } from './interest.types';

const CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function encodeInterestCursor(position: InterestPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.createdAt, i: position.id }),
  ).toString('base64url');
}

export function decodeInterestCursor(raw: string): InterestPosition {
  const bytes = Buffer.from(raw, 'base64url');

  if (bytes.toString('base64url') !== raw) {
    throw invalidInterestCursor();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw invalidInterestCursor();
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw invalidInterestCursor();
  }

  const { t, i } = parsed as { t?: unknown; i?: unknown };

  if (
    typeof t !== 'string' ||
    typeof i !== 'string' ||
    !CREATED_AT.test(t) ||
    !UUID.test(i) ||
    Number.isNaN(Date.parse(`${t.slice(0, 19)}Z`))
  ) {
    throw invalidInterestCursor();
  }

  return { createdAt: t, id: i };
}
