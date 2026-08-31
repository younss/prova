import { describe, expect, it } from 'vitest';
import { formatSimulatedDuration } from '../../src/views/formatSimulatedDuration';

describe('formatSimulatedDuration', () => {
  it('formats zero as "0 min"', () => {
    expect(formatSimulatedDuration(0)).toBe('0 min');
  });

  it('formats a duration under an hour as minutes only', () => {
    expect(formatSimulatedDuration(90_000)).toBe('1 min'); // 1.5 min, floored
  });

  it('formats a duration with hours and minutes, no days', () => {
    const twoHoursFifteenMin = 2 * 60 * 60 * 1000 + 15 * 60 * 1000;
    expect(formatSimulatedDuration(twoHoursFifteenMin)).toBe('2 h 15 min');
  });

  it('formats a duration with days, hours, and minutes', () => {
    const threeDaysTwoHours = 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000;
    expect(formatSimulatedDuration(threeDaysTwoHours)).toBe('3 j 2 h 0 min');
  });
});
