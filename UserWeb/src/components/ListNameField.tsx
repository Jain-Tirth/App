import { FieldError } from './ErrorNotice';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LIST_NAME_MAX } from '../lib/shortlists';

interface ListNameFieldProps {
  id: string;
  label: string;
  value: string;
  error: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** Name input with a live 1 to 100 character counter and an inline error. */
export function ListNameField({ id, label, value, error, disabled, onChange }: ListNameFieldProps) {
  const length = value.trim().length;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-count`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p
        id={`${id}-count`}
        data-testid={`${id}-counter`}
        className={`text-xs ${length > LIST_NAME_MAX ? 'text-red-600' : 'text-brand-muted'}`}
      >
        {length} / {LIST_NAME_MAX} characters
      </p>
      <FieldError name={id} text={error} />
    </div>
  );
}
