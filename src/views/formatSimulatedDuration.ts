// Displays elapsed simulated time (spec §5.1) as a duration ("3 j 2 h 15 min"), not a calendar
// date — the engine's clock counts elapsed simulated ms from an arbitrary zero point, not real
// epoch time, so a calendar-style display would require inventing a fake start date the spec
// never specifies.
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatSimulatedDuration(elapsedMs: number): string {
  const days = Math.floor(elapsedMs / DAY_MS);
  const hours = Math.floor((elapsedMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((elapsedMs % HOUR_MS) / MINUTE_MS);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} j`);
  }
  if (days > 0 || hours > 0) {
    parts.push(`${hours} h`);
  }
  parts.push(`${minutes} min`);
  return parts.join(' ');
}
