// Append-only audit log (spec §5.5): "qui, quoi, quand, sur quel dossier, avec quelle
// justification". No function here may update or delete an entry — not even in tests
// (CLAUDE.md). Timestamps are simulated time supplied by the caller, never Date.now().

export interface RecordAuditEntryInput {
  readonly caseId: string;
  /** "qui" — the acting identity (role + fictitious username). */
  readonly actor: string;
  /** "quoi" — a transition id, or a sentinel like "blocked-attempt". */
  readonly action: string;
  /** "avec quelle justification" — a human-readable reason, shown verbatim in the audit UI. */
  readonly justification: string;
  /** "quand" — simulated time (SimulatedClock.now()), never wall-clock time. */
  readonly simulatedTimestampMs: number;
}

export interface AuditEntry extends RecordAuditEntryInput {
  readonly id: string;
}

export interface AuditLog {
  record(input: RecordAuditEntryInput): AuditEntry;
  entriesForCase(caseId: string): readonly AuditEntry[];
  allEntries(): readonly AuditEntry[];
  toJson(): string;
}

export function createAuditLog(): AuditLog {
  const entries: AuditEntry[] = [];
  let nextId = 1;

  function record(input: RecordAuditEntryInput): AuditEntry {
    const entry: AuditEntry = Object.freeze({ id: `audit-${nextId}`, ...input });
    nextId += 1;
    entries.push(entry);
    return entry;
  }

  function entriesForCase(caseId: string): readonly AuditEntry[] {
    return entries.filter((entry) => entry.caseId === caseId);
  }

  function allEntries(): readonly AuditEntry[] {
    return [...entries];
  }

  function toJson(): string {
    return JSON.stringify(entries, null, 2);
  }

  return { record, entriesForCase, allEntries, toJson };
}
