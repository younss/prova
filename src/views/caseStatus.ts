// Case status badge color mapping (spec §5.7). Kept separate from CaseStatusBadge.tsx so that
// file only exports the component (react-refresh/only-export-components).
import type { ScenarioStep } from '../scenarios/types';

export type StatusVariant = 'neutral' | 'active' | 'waiting' | 'success' | 'danger';

/**
 * Presentation-only mapping — not a routing/business decision, so it doesn't conflict with
 * CLAUDE.md's "scenarios are data" rule. Color follows the step's actorType generically;
 * 'payment'/'rejected' are the only two scenario-specific overrides, since a terminal step's
 * good/bad outcome isn't otherwise encoded in ScenarioStep.
 */
export function getStatusVariant(step: ScenarioStep): StatusVariant {
  if (step.id === 'payment') {
    return 'success';
  }
  if (step.id === 'rejected') {
    return 'danger';
  }
  if (step.actorType === 'third-party-async') {
    return 'waiting';
  }
  if (step.actorType === 'human') {
    return 'active';
  }
  return 'neutral';
}
