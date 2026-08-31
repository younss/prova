// Case status badge (spec §5.7): a colored badge per case reflecting its current step, replacing
// plain step-id/label text across every view that lists cases.
import type { ScenarioStep } from '../scenarios/types';
import { getStatusVariant } from './caseStatus';

export function CaseStatusBadge({ step }: { step: ScenarioStep }) {
  const variant = getStatusVariant(step);
  return <span className={`status-badge status-badge--${variant}`}>{step.label}</span>;
}
