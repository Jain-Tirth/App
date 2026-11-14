import { Badge } from './ui/badge';
import type { SlaState } from '../types';

const LABEL: Record<SlaState, string> = {
  ok: 'On track',
  atRisk: 'At risk',
  overdue: 'Overdue',
};

const VARIANT: Record<SlaState, 'secondary' | 'pending' | 'approved'> = {
  ok: 'secondary',
  atRisk: 'pending',
  overdue: 'approved',
};

/** Internal review-clock badge; the SLA is never shown to members. */
export function SlaBadge({
  state,
  remainingHours,
}: {
  state: SlaState;
  remainingHours: number;
}) {
  const hours = Math.abs(remainingHours).toFixed(1);
  const detail = remainingHours < 0 ? `${hours}h over` : `${hours}h left`;

  return (
    <Badge variant={VARIANT[state]} data-testid="sla-badge" data-sla-state={state}>
      {LABEL[state]} · {detail}
    </Badge>
  );
}
