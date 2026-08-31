import { describe, expect, it } from 'vitest';
import { createAuditLog } from '../../src/audit/auditLog';
import { formatCaseAge } from '../../src/views/caseAge';

describe('formatCaseAge', () => {
  it("formats elapsed time since the case's first audit entry", () => {
    const auditLog = createAuditLog();
    auditLog.record({
      caseId: 'SIN-0001',
      actor: 'Client',
      action: 'submit-declaration',
      justification: 'Déclaration soumise via le formulaire.',
      simulatedTimestampMs: 1_000,
    });

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const result = formatCaseAge(auditLog, 'SIN-0001', 1_000 + TWO_HOURS_MS);

    expect(result).toBe('ouvert il y a 2 h 0 min');
  });

  it('treats a case with no audit history as just opened', () => {
    const auditLog = createAuditLog();

    const result = formatCaseAge(auditLog, 'SIN-9999', 5_000);

    expect(result).toBe('ouvert il y a 0 min');
  });
});
