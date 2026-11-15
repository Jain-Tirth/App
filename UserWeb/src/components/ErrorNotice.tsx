import { AlertCircle } from 'lucide-react';
import type { FriendlyError } from '../errors/messages';

interface ErrorNoticeProps {
  error: FriendlyError | null;
  testId?: string;
  className?: string;
}

/**
 * Renders a mapped error. The support reference (request id) sits on its own
 * small line and is never part of the sentence.
 */
export function ErrorNotice({ error, testId = 'form-error', className = '' }: ErrorNoticeProps) {
  if (!error) return null;
  const { message: text, reference } = error;
  return (
    <div
      role="alert"
      data-testid={testId}
      className={`flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 ${className}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <div className="min-w-0">
        <p data-testid={`${testId}-text`} className="font-medium">
          {text}
        </p>
        {reference ? (
          <p data-testid={`${testId}-reference`} className="mt-1 text-xs text-red-800">
            Reference: {reference}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface FieldErrorProps {
  name: string;
  text?: string | null;
}

/** Inline message under a single form field. */
export function FieldError({ name, text }: FieldErrorProps) {
  if (!text) return null;
  return (
    <p data-testid={`field-error-${name}`} role="alert" className="mt-1 text-xs font-medium text-red-600">
      {text}
    </p>
  );
}
