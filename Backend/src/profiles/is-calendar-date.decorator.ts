import { ValidateBy, buildMessage } from 'class-validator';
import { isCalendarDate } from './age-gate';

/** Field-level validation: a real `YYYY-MM-DD` calendar date. */
export function IsCalendarDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isCalendarDate',
    validator: {
      validate: (value: unknown) => isCalendarDate(value),
      defaultMessage: buildMessage(
        (eachPrefix) =>
          `${eachPrefix}$property must be a real calendar date in YYYY-MM-DD format`,
      ),
    },
  });
}
