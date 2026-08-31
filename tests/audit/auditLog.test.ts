import { describe, expect, it } from 'vitest';
import { createAuditLog } from '../../src/audit/auditLog';

describe('createAuditLog', () => {
  it('exposes only an append-only surface — no update or delete method exists', () => {
    const auditLog = createAuditLog();
    expect(Object.keys(auditLog).sort()).toEqual(
      ['allEntries', 'entriesForCase', 'record', 'toJson'].sort(),
    );
  });

  it('records an entry and assigns it an id', () => {
    const auditLog = createAuditLog();
    const entry = auditLog.record({
      caseId: 'case-1',
      actor: 'analyste-1',
      action: 'submit-declaration',
      justification: 'Déclaration soumise par le client.',
      simulatedTimestampMs: 1000,
    });

    expect(entry.id).toBeTruthy();
    expect(entry.caseId).toBe('case-1');
    expect(entry.action).toBe('submit-declaration');
  });

  it('assigns distinct ids to successive entries', () => {
    const auditLog = createAuditLog();
    const first = auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'x',
      justification: 'j',
      simulatedTimestampMs: 0,
    });
    const second = auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'y',
      justification: 'j',
      simulatedTimestampMs: 1,
    });

    expect(first.id).not.toBe(second.id);
  });

  it('filters entries by caseId, preserving recording order', () => {
    const auditLog = createAuditLog();
    auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'step-1',
      justification: 'j',
      simulatedTimestampMs: 0,
    });
    auditLog.record({
      caseId: 'case-2',
      actor: 'a',
      action: 'step-1',
      justification: 'j',
      simulatedTimestampMs: 1,
    });
    auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'step-2',
      justification: 'j',
      simulatedTimestampMs: 2,
    });

    const case1Entries = auditLog.entriesForCase('case-1');
    expect(case1Entries.map((entry) => entry.action)).toEqual(['step-1', 'step-2']);
  });

  it('returns all entries across cases via allEntries', () => {
    const auditLog = createAuditLog();
    auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'step-1',
      justification: 'j',
      simulatedTimestampMs: 0,
    });
    auditLog.record({
      caseId: 'case-2',
      actor: 'a',
      action: 'step-1',
      justification: 'j',
      simulatedTimestampMs: 1,
    });

    expect(auditLog.allEntries()).toHaveLength(2);
  });

  it('mutating a returned entries array does not affect the log', () => {
    const auditLog = createAuditLog();
    auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'step-1',
      justification: 'j',
      simulatedTimestampMs: 0,
    });

    const entries = auditLog.allEntries() as unknown as Array<unknown>;
    entries.push({ intruder: true });

    expect(auditLog.allEntries()).toHaveLength(1);
  });

  it('exports all entries as valid, parseable JSON', () => {
    const auditLog = createAuditLog();
    auditLog.record({
      caseId: 'case-1',
      actor: 'a',
      action: 'step-1',
      justification: 'j',
      simulatedTimestampMs: 42,
    });

    const parsed = JSON.parse(auditLog.toJson());
    expect(parsed).toEqual(auditLog.allEntries());
  });
});
