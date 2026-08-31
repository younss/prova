// Case age display (spec §5.1: "ouvert il y a 2 j 4 h") — derived from the case's own first
// audit entry rather than a new stored field on CaseRecord, since the audit log already records
// when a case was opened.
import type { AuditLog } from '../audit/auditLog';
import { formatSimulatedDuration } from './formatSimulatedDuration';

export function formatCaseAge(auditLog: AuditLog, caseId: string, nowMs: number): string {
  const entries = auditLog.entriesForCase(caseId);
  const openedAtMs = entries[0]?.simulatedTimestampMs ?? nowMs;
  return `ouvert il y a ${formatSimulatedDuration(nowMs - openedAtMs)}`;
}
