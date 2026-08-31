// Fixed, deterministic list of fictitious usernames for the "identité active" selector (spec
// §5.6: "un nom d'utilisateur fictif sélectionnable"). Reuses the synthetic name lists (single
// source of truth for fake identities — CLAUDE.md) rather than inventing a separate list.
import type { Role } from '../app/caseStore';
import { FIRST_NAMES, LAST_NAMES } from '../synthetic/data';

export const ACTIVE_IDENTITY_OPTIONS: readonly string[] = FIRST_NAMES.slice(0, 5).map(
  (firstName, index) => `${firstName} ${LAST_NAMES[index]}`,
);

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Client',
  analyst: 'Analyste sinistres',
  supervisor: 'Superviseur',
};
