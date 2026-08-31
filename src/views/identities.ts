// Fixed, deterministic list of fictitious usernames for the "identité active" selector (spec
// §5.6: "un nom d'utilisateur fictif sélectionnable"). Reuses the synthetic name lists (single
// source of truth for fake identities — CLAUDE.md) rather than inventing a separate list.
import type { Role } from '../app/caseStore';
import { FIRST_NAMES, LAST_NAMES } from '../synthetic/data';

export const ACTIVE_IDENTITY_OPTIONS: readonly string[] = FIRST_NAMES.slice(0, 5).map(
  (firstName, index) => `${firstName} ${LAST_NAMES[index]}`,
);

/** The role switcher's tabs: the domain roles plus the facilitator control panel (spec §4.4) and
 *  Control Tower (spec §4.5), neither of which is a queue-participant Role at the store level. */
export type ViewTab = Role | 'facilitator' | 'control-tower';

export const VIEW_TAB_LABELS: Record<ViewTab, string> = {
  client: 'Client',
  analyst: 'Analyste sinistres',
  supervisor: 'Superviseur',
  facilitator: 'Animateur',
  'control-tower': 'Tour de contrôle',
};
