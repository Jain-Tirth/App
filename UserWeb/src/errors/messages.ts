/**
 * The single place where an error becomes text a member can read.
 *
 * Rules (error-message policy):
 * - Nothing here, and nothing a page renders, is ever a raw code, JSON, stack
 *   text, HTTP status line or the English `message` field of the API.
 * - The backend returns no specific code for auth, OTP and login failures, only
 *   status-derived codes. Those are therefore resolved by call context plus
 *   status, never by message text.
 * - The request id is returned separately as `reference` for a small support
 *   line. It is never part of `message`.
 * - Unknown codes get GENERIC_MESSAGE and nothing else.
 */
import { ApiError, isApiError } from '../apiError';

export type ErrorContext =
  | 'register'
  | 'otpSend'
  | 'otpVerify'
  | 'login'
  | 'refresh'
  | 'profile'
  | 'step'
  | 'consents'
  | 'kyc'
  | 'kycUpload'
  | 'kycRestart'
  | 'storage'
  | 'matches'
  | 'generic';

export interface FriendlyError {
  /** Short, polite, plain-language sentence. */
  message: string;
  /** Field-level messages keyed by form field name. */
  fields: Record<string, string>;
  /** Request id for a small "Reference: ..." support line, or null. */
  reference: string | null;
}

export const GENERIC_MESSAGE = 'Something went wrong. Please try again in a moment.';

export function formatWait(seconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (hours === 0) return unit(minutes, 'minute');
  if (minutes === 0) return unit(hours, 'hour');
  return `${unit(hours, 'hour')} and ${unit(minutes, 'minute')}`;
}

const ACCOUNT_CONFLICT =
  'We could not create an account with these details. If you already have an account, please sign in instead.';
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

/** Field-level messages. Keys are request field names. */
export const FIELD_MESSAGES: Record<string, string> = {
  fullName: 'Enter your full name, using at least 2 characters.',
  email: 'Enter a valid email address.',
  password: 'Password must be 8 to 20 characters long.',
  countryCode: 'Choose a valid country code.',
  mobileNumber: 'Enter a valid 10-digit mobile number.',
  profileCreatedBy: 'Choose who this profile is for.',
  gender: 'Choose a gender.',
  dateOfBirth: 'Enter a real date of birth.',
  heightCm: 'Enter a valid height.',
  weightKg: 'Enter a valid weight.',
  idNumber: 'ID number must be 4 to 32 letters, digits, spaces or hyphens.',
  documentType: 'Choose a document type from the list.',
  consents: 'Please accept all of the required documents.',
  otpCode: 'Enter the 4-digit code.',
};

type Builder = (err: ApiError) => string;

const constant = (text: string): Builder => () => text;

/** One entry for every code UserWeb can receive from the endpoints it calls. */
export const CODE_MESSAGES: Record<string, Builder> = {
  VALIDATION_ERROR: constant(
    'Some details look incorrect. Please check what you entered and try again.',
  ),
  AGE_BELOW_MINIMUM: (err) => {
    const minimum = readMinimumAge(err.details);
    return minimum === null
      ? 'You do not meet the minimum age to join.'
      : `Members must be at least ${minimum} years old to join.`;
  },
  INVALID_DATE_OF_BIRTH: constant('Enter a real date of birth that is not in the future.'),
  CONSENT_REQUIRED: constant(
    'We need your consent to the current documents before we can continue. Please review and accept them.',
  ),
  CONSENT_DOCUMENT_MISMATCH: constant(
    'The documents have been updated. Please review and accept the latest versions.',
  ),
  VERIFICATION_ALREADY_EXISTS: constant(
    'You have already started identity verification, so we have opened your existing case.',
  ),
  VERIFICATION_NOT_FOUND: constant(
    'We could not find an identity verification for your account. Please start one.',
  ),
  MEDIA_NOT_FOUND: constant('We could not find that file. Please upload it again.'),
  FILE_TOO_LARGE: constant('That file is too large. Please choose a file under 10 MB.'),
  FILE_TYPE_NOT_ALLOWED: constant(
    'That file type is not supported. Please use a JPEG, PNG or WebP image, or a PDF for your ID.',
  ),
  FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE: constant(
    'That file type cannot be used here. Photos must be JPEG, PNG or WebP, and ID documents may also be PDF.',
  ),
  SIZE_MISMATCH: constant('The upload did not arrive in full. Please try uploading the file again.'),
  CHECKSUM_MISMATCH: constant(
    'The file was changed or damaged during upload. Please try uploading it again.',
  ),
  FILE_CONTENT_MISMATCH: constant(
    'The file does not match the type it claims to be. Please choose a genuine image or PDF.',
  ),
  UPLOAD_NOT_FOUND: constant(
    'Your upload expired or could not be found. Please upload the file again.',
  ),
  MEDIA_ALREADY_ATTACHED: constant(
    'That file is already part of your verification. To replace it, please start over.',
  ),
  RESTART_LIMIT_REACHED: (err) =>
    err.retryAfter && err.retryAfter > 0
      ? `You have restarted verification too many times. Please try again in ${formatWait(err.retryAfter)}.`
      : 'You have restarted verification too many times. Please try again later.',
  INVALID_STATUS_TRANSITION: constant(
    'That action is not available at this stage of your verification.',
  ),
  PROFILE_NOT_APPROVED: constant(
    'Your profile has not been approved yet. This will be available once it is approved.',
  ),
  USER_EXISTS: constant(ACCOUNT_CONFLICT),

  // Status-derived codes. Context-specific wording is applied first.
  BAD_REQUEST: constant('We could not complete that. Please check your details and try again.'),
  UNAUTHORIZED: constant(SESSION_EXPIRED),
  FORBIDDEN: constant(
    'You do not have access to this. Please contact support if you think this is a mistake.',
  ),
  NOT_FOUND: constant('We could not find what you were looking for.'),
  CONFLICT: constant('That could not be done because something changed. Please refresh and try again.'),
  UNPROCESSABLE_ENTITY: constant('Some details could not be processed. Please check them and try again.'),
  RATE_LIMITED: (err) =>
    err.retryAfter && err.retryAfter > 0
      ? `Too many attempts. Please try again in ${formatWait(err.retryAfter)}.`
      : 'Too many attempts. Please wait a little and try again.',
  INTERNAL_ERROR: constant('Something went wrong on our side. Please try again in a moment.'),
  HTTP_ERROR: constant(GENERIC_MESSAGE),

  // Client-side codes.
  NETWORK_ERROR: constant(
    'We could not reach the server. Please check your internet connection and try again.',
  ),
  TIMEOUT: constant('That is taking too long. Please try again.'),
  NON_JSON_RESPONSE: constant(GENERIC_MESSAGE),
};

export const REQUIRED_CODES: string[] = Object.keys(CODE_MESSAGES);

/** Codes the backend derives from the HTTP status alone (see ApiExceptionFilter). */
const STATUS_DERIVED_CODES = new Set([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'HTTP_ERROR',
]);

/**
 * Wording for status-derived errors by call context. Key: `<context>:<status>`
 * or `*:<status>` for every context. The backend gives no specific code for
 * these, so the context and status are the only reliable signals.
 */
export const CONTEXT_STATUS_MESSAGES: Record<string, string> = {
  'register:409': ACCOUNT_CONFLICT,
  'otpSend:400':
    'We could not send a code for this mobile number. Please check the number, or sign in if you have already verified it.',
  'otpVerify:400':
    'That code is not correct, or it has expired. Please check it and try again, or request a new code.',
  'otpSend:401': 'Your verification session has expired. Please request a new code.',
  'otpVerify:401': 'Your verification session has expired. Please request a new code.',
  'login:401': 'The email or password is incorrect. Please check them and try again.',
  'login:403':
    'We could not sign you in. Your mobile number may not be verified yet, or your account may be on hold. Please contact support if you need help.',
  'refresh:401': 'Your session has ended. Please sign in again.',
  'storage:403': 'The upload link has expired. Please try uploading the file again.',
  'storage:400': 'The upload was not accepted. Please try uploading the file again.',
  '*:401': SESSION_EXPIRED,
};

function readMinimumAge(details: unknown): number | null {
  if (details && typeof details === 'object' && 'minimumAge' in details) {
    const value = (details as { minimumAge: unknown }).minimumAge;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function fieldFromIssue(issue: unknown): string | null {
  if (typeof issue === 'string') {
    const first = issue.trim().split(/\s+/)[0] ?? '';
    return first.split('.')[0] || null;
  }
  if (issue && typeof issue === 'object') {
    const record = issue as { field?: unknown; path?: unknown; property?: unknown };
    if (typeof record.field === 'string') return record.field.split('.')[0];
    if (typeof record.property === 'string') return record.property.split('.')[0];
    if (Array.isArray(record.path) && typeof record.path[0] === 'string') return record.path[0];
  }
  return null;
}

function validationFields(details: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!details || typeof details !== 'object') return fields;
  const record = details as { issues?: unknown; fields?: unknown };
  const names: Array<string | null> = [];
  if (Array.isArray(record.issues)) names.push(...record.issues.map(fieldFromIssue));
  if (record.fields && typeof record.fields === 'object') names.push(...Object.keys(record.fields));
  for (const name of names) {
    if (name && Object.prototype.hasOwnProperty.call(FIELD_MESSAGES, name)) {
      fields[name] = FIELD_MESSAGES[name];
    }
  }
  return fields;
}

function resolveMessage(err: ApiError, context: ErrorContext): string {
  if (STATUS_DERIVED_CODES.has(err.code)) {
    const specific =
      CONTEXT_STATUS_MESSAGES[`${context}:${err.status}`] ??
      (err.status === 401 ? CONTEXT_STATUS_MESSAGES['*:401'] : undefined);
    if (specific) return specific;
  }
  const build = CODE_MESSAGES[err.code];
  return build ? build(err) : GENERIC_MESSAGE;
}

/**
 * Message for a problem found by a client-side check before the request is
 * sent. Uses the same table as the server's answer so both read identically.
 */
export function describeCode(
  code: string,
  details: unknown = null,
  context: ErrorContext = 'generic',
): FriendlyError {
  return describeError(new ApiError({ code, status: 400, details }), context);
}

/** Turns anything thrown by the API client into text that is safe to show. */
export function describeError(error: unknown, context: ErrorContext = 'generic'): FriendlyError {
  if (!isApiError(error)) {
    return { message: GENERIC_MESSAGE, fields: {}, reference: null };
  }

  const reference = error.requestId;
  let fields: Record<string, string> = {};
  let message = resolveMessage(error, context);

  if (error.code === 'VALIDATION_ERROR') {
    fields = validationFields(error.details);
    if (Object.keys(fields).length > 0) message = 'Please correct the details marked below.';
  } else if (error.code === 'AGE_BELOW_MINIMUM') {
    fields = { dateOfBirth: message };
  } else if (error.code === 'INVALID_DATE_OF_BIRTH') {
    fields = { dateOfBirth: message };
  }

  return { message, fields, reference };
}
