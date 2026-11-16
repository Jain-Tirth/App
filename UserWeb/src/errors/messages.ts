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
import { formatRetryDate } from '../lib/interests';

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
  | 'discovery'
  | 'submit'
  | 'withdraw'
  | 'interests'
  | 'shortlists'
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

/**
 * Sentences for the shortlist name field. Kept apart from the iterated tables
 * because the length sentence names the limit itself.
 */
export const SHORTLIST_NAME_REQUIRED_MESSAGE = 'Enter a name for your list.';
export const SHORTLIST_NAME_TOO_LONG_MESSAGE = 'Use 100 characters or fewer.';
const SHORTLIST_NAME_TAKEN_MESSAGE = 'You already have a list with this name.';

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
  SUBMISSION_INCOMPLETE: constant(
    'Your profile is not complete yet. Please finish the items listed below and submit again.',
  ),
  PROFILE_LOCKED_IN_REVIEW: constant(
    'Your profile is being reviewed, so it cannot be edited right now. Choose "Withdraw to edit" on your status page if you need to make changes.',
  ),
  USER_EXISTS: constant(ACCOUNT_CONFLICT),
  INVALID_CURSOR: constant(
    'Your search results are out of date. Please start the search again.',
  ),
  PROFILE_NOT_FOUND: constant("This profile isn't available."),
  CANNOT_INTEREST_SELF: constant('You cannot send an interest to your own profile.'),
  INTEREST_ALREADY_EXISTS: constant('You have already sent an interest to this member.'),
  INTEREST_COOLDOWN: (err) => formatRetryDate(readRetryAfter(err.details)),
  INTEREST_NOT_FOUND: constant(
    'We could not find that interest. Please refresh your interests and try again.',
  ),
  COOLDOWN_NOT_FOUND: constant('There is no active cooldown for this pair.'),
  DEFAULT_SHORTLIST_PROTECTED: constant(
    'Your Shortlisted list is always kept, so it cannot be renamed or deleted. You can create another list instead.',
  ),
  SHORTLIST_NAME_TAKEN: constant(SHORTLIST_NAME_TAKEN_MESSAGE),
  SHORTLIST_NOT_FOUND: constant(
    'That list is no longer available. We have refreshed your lists, so please choose one and try again.',
  ),
  SHORTLIST_LIMIT_EXCEEDED: constant(
    'You have reached the limit for your shortlists. Please remove a profile or a list you no longer need and try again.',
  ),
  CANNOT_SHORTLIST_SELF: constant('You cannot add your own profile to a shortlist.'),

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

const NOT_APPROVED_FOR_ACTION =
  'Your profile has not been approved yet, so this is not available. You can follow its progress on your status page.';

/**
 * Wording that depends on the call context as well as the code. Key:
 * `<context>:<CODE>`. Consulted before CODE_MESSAGES.
 */
export const CONTEXT_CODE_MESSAGES: Record<string, string> = {
  'submit:INVALID_STATUS_TRANSITION':
    'Your profile cannot be submitted right now because its status has changed. Please refresh to see where it stands.',
  'withdraw:INVALID_STATUS_TRANSITION':
    'Your profile can no longer be withdrawn because its review has already moved on. Please refresh to see the latest status.',
  'submit:PROFILE_NOT_APPROVED': NOT_APPROVED_FOR_ACTION,
  'withdraw:PROFILE_NOT_APPROVED': NOT_APPROVED_FOR_ACTION,
  'discovery:PROFILE_NOT_APPROVED':
    'Your profile needs to be approved before you can browse other profiles. You can follow its progress on your status page.',
  'discovery:VALIDATION_ERROR':
    'That search could not be understood. Please clear the filters and try again.',
  'interests:INVALID_STATUS_TRANSITION':
    'This interest has already changed, so that action is no longer available. Please refresh to see its latest status.',
  'interests:PROFILE_NOT_FOUND': "This member's profile isn't available, so an interest cannot be sent.",
  'interests:PROFILE_NOT_APPROVED':
    'Your profile needs to be approved before you can send or answer interests. You can follow its progress on your status page.',
  'interests:RATE_LIMITED':
    'You have reached the limit of interests you can send today. Please try again tomorrow.',
  'shortlists:PROFILE_NOT_FOUND':
    "This profile isn't available, so it cannot be added to a shortlist.",
  'shortlists:VALIDATION_ERROR':
    'That list name could not be used. Please check it and try again.',
};

/** Which sentence the shortlist name field gets for the issues the server named. */
function shortlistNameMessage(details: unknown): string {
  const issues =
    details && typeof details === 'object' && Array.isArray((details as { issues?: unknown }).issues)
      ? ((details as { issues: unknown[] }).issues as unknown[])
      : [];
  const tooLong = issues.some(
    (issue) =>
      typeof issue === 'string' && fieldFromIssue(issue) === 'name' && /shorter than/i.test(issue),
  );
  return tooLong ? SHORTLIST_NAME_TOO_LONG_MESSAGE : SHORTLIST_NAME_REQUIRED_MESSAGE;
}

function readRetryAfter(details: unknown): unknown {
  return details && typeof details === 'object' && 'retryAfter' in details
    ? (details as { retryAfter: unknown }).retryAfter
    : null;
}

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
  const contextual = CONTEXT_CODE_MESSAGES[`${context}:${err.code}`];
  if (contextual) return contextual;
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
    if (context === 'shortlists') {
      const names = Array.isArray((error.details as { issues?: unknown } | null)?.issues)
        ? ((error.details as { issues: unknown[] }).issues.map(fieldFromIssue) as Array<string | null>)
        : [];
      if (names.includes('name')) {
        fields = { name: shortlistNameMessage(error.details) };
        message = fields.name;
      }
    } else {
      fields = validationFields(error.details);
      if (Object.keys(fields).length > 0) message = 'Please correct the details marked below.';
    }
  } else if (error.code === 'SHORTLIST_NAME_TAKEN') {
    fields = { name: message };
  } else if (error.code === 'AGE_BELOW_MINIMUM') {
    fields = { dateOfBirth: message };
  } else if (error.code === 'INVALID_DATE_OF_BIRTH') {
    fields = { dateOfBirth: message };
  }

  return { message, fields, reference };
}
