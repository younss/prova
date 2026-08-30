import { describe, expect, it, vi } from 'vitest';
import { CLOCK_SPEEDS, createSimulatedClock } from '../../src/engine/clock';

describe('createSimulatedClock', () => {
  it('starts paused, at speed x1, at the given start time', () => {
    const clock = createSimulatedClock(1000);

    expect(clock.now()).toBe(1000);
    expect(clock.isPlaying()).toBe(false);
    expect(clock.speed()).toBe(1);
  });

  it('defaults the start time to 0', () => {
    expect(createSimulatedClock().now()).toBe(0);
  });

  it('toggles play/pause', () => {
    const clock = createSimulatedClock();

    clock.play();
    expect(clock.isPlaying()).toBe(true);

    clock.pause();
    expect(clock.isPlaying()).toBe(false);
  });

  it('accepts any documented speed multiplier', () => {
    const clock = createSimulatedClock();

    for (const speed of CLOCK_SPEEDS) {
      clock.setSpeed(speed);
      expect(clock.speed()).toBe(speed);
    }
  });

  it('rejects a speed outside the documented multipliers', () => {
    const clock = createSimulatedClock();

    // @ts-expect-error — 3 is not a valid ClockSpeed; verifying the runtime guard for UI-originated values.
    expect(() => clock.setSpeed(3)).toThrow(/Invalid clock speed/);
  });

  it('advances simulated time by the given delta', () => {
    const clock = createSimulatedClock(0);

    clock.advance(5000);

    expect(clock.now()).toBe(5000);
  });

  it('rejects advancing by a negative delta', () => {
    const clock = createSimulatedClock();

    expect(() => clock.advance(-1)).toThrow(/negative/);
  });

  it('advance() moves time regardless of play/pause state', () => {
    const clock = createSimulatedClock();

    clock.advance(10);

    expect(clock.now()).toBe(10);
    expect(clock.isPlaying()).toBe(false);
  });

  it('fires a scheduled event once simulated time reaches its due time', () => {
    const clock = createSimulatedClock(0);
    const onDue = vi.fn();
    clock.schedule({ id: 'expertise-due', dueAt: 100 }, onDue);

    clock.advance(50);
    expect(onDue).not.toHaveBeenCalled();

    clock.advance(50);
    expect(onDue).toHaveBeenCalledTimes(1);
    expect(onDue).toHaveBeenCalledWith({ id: 'expertise-due', dueAt: 100 });
  });

  it('fires an event exactly once even if advance() overshoots it', () => {
    const clock = createSimulatedClock(0);
    const onDue = vi.fn();
    clock.schedule({ id: 'e', dueAt: 100 }, onDue);

    clock.advance(1000);
    clock.advance(1000);

    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it('fires multiple due events in dueAt order', () => {
    const clock = createSimulatedClock(0);
    const order: string[] = [];
    clock.schedule({ id: 'second', dueAt: 200 }, () => order.push('second'));
    clock.schedule({ id: 'first', dueAt: 100 }, () => order.push('first'));

    clock.advance(300);

    expect(order).toEqual(['first', 'second']);
  });

  it('rejects scheduling two events under the same id', () => {
    const clock = createSimulatedClock();
    clock.schedule({ id: 'dup', dueAt: 10 }, () => {});

    expect(() => clock.schedule({ id: 'dup', dueAt: 20 }, () => {})).toThrow(/already scheduled/);
  });

  it('rejects scheduling an event in the past', () => {
    const clock = createSimulatedClock(500);

    expect(() => clock.schedule({ id: 'late', dueAt: 100 }, () => {})).toThrow(/past/);
  });

  it('cancel() prevents a scheduled event from firing', () => {
    const clock = createSimulatedClock(0);
    const onDue = vi.fn();
    clock.schedule({ id: 'cancel-me', dueAt: 100 }, onDue);

    clock.cancel('cancel-me');
    clock.advance(200);

    expect(onDue).not.toHaveBeenCalled();
  });

  it('cancel() on an unknown id is a no-op', () => {
    const clock = createSimulatedClock();

    expect(() => clock.cancel('never-scheduled')).not.toThrow();
  });

  describe('peekNextEvent', () => {
    it('returns undefined when nothing is scheduled', () => {
      expect(createSimulatedClock().peekNextEvent()).toBeUndefined();
    });

    it('returns the earliest of several scheduled events', () => {
      const clock = createSimulatedClock(0);
      clock.schedule({ id: 'later', dueAt: 200 }, () => {});
      clock.schedule({ id: 'sooner', dueAt: 100 }, () => {});

      expect(clock.peekNextEvent()).toEqual({ id: 'sooner', dueAt: 100 });
    });
  });

  describe('advanceToNextEvent', () => {
    it('is a no-op when no event is scheduled', () => {
      const clock = createSimulatedClock(42);

      clock.advanceToNextEvent();

      expect(clock.now()).toBe(42);
    });

    it('jumps straight to the next event and fires it', () => {
      const clock = createSimulatedClock(0);
      const onDue = vi.fn();
      clock.schedule({ id: 'expertise-due', dueAt: 3 * 24 * 60 * 60 * 1000 }, onDue);

      clock.advanceToNextEvent();

      expect(clock.now()).toBe(3 * 24 * 60 * 60 * 1000);
      expect(onDue).toHaveBeenCalledTimes(1);
    });

    it('fires every event tied for the earliest due time, but not later ones', () => {
      const clock = createSimulatedClock(0);
      const fired: string[] = [];
      clock.schedule({ id: 'a', dueAt: 100 }, () => fired.push('a'));
      clock.schedule({ id: 'b', dueAt: 100 }, () => fired.push('b'));
      clock.schedule({ id: 'c', dueAt: 200 }, () => fired.push('c'));

      clock.advanceToNextEvent();

      expect(fired.sort()).toEqual(['a', 'b']);
      expect(clock.now()).toBe(100);
    });

    it('advances repeatedly to walk through all scheduled events one at a time', () => {
      const clock = createSimulatedClock(0);
      const fired: string[] = [];
      clock.schedule({ id: 'a', dueAt: 100 }, () => fired.push('a'));
      clock.schedule({ id: 'b', dueAt: 200 }, () => fired.push('b'));

      clock.advanceToNextEvent();
      clock.advanceToNextEvent();

      expect(fired).toEqual(['a', 'b']);
      expect(clock.now()).toBe(200);
    });
  });
});
