// Simulated clock (spec §5.1): no Date.now()/setTimeout/setInterval — time only moves via advance().
export const CLOCK_SPEEDS = [1, 100, 500, 2000] as const;

export type ClockSpeed = (typeof CLOCK_SPEEDS)[number];

export interface ScheduledEvent {
  readonly id: string;
  readonly dueAt: number;
}

type EventListener = (event: ScheduledEvent) => void;

export interface SimulatedClock {
  /** Current simulated time, in simulated milliseconds since the clock's start. */
  now(): number;
  isPlaying(): boolean;
  speed(): ClockSpeed;
  play(): void;
  pause(): void;
  setSpeed(speed: ClockSpeed): void;
  /** Advances simulated time by `deltaMs` and fires due events; ignores isPlaying() — gating is the caller's job. */
  advance(deltaMs: number): void;
  /** Jumps straight to the earliest scheduled event and fires it (a no-op if none is scheduled). */
  advanceToNextEvent(): void;
  /** Registers a one-shot callback to fire once simulated time reaches `event.dueAt`. */
  schedule(event: ScheduledEvent, onDue: EventListener): void;
  /** Cancels a previously scheduled event; a no-op if it already fired or was never scheduled. */
  cancel(eventId: string): void;
  /** The earliest scheduled event, or `undefined` if none is pending. */
  peekNextEvent(): ScheduledEvent | undefined;
}

export function createSimulatedClock(startAt = 0): SimulatedClock {
  let currentTime = startAt;
  let playing = false;
  let currentSpeed: ClockSpeed = CLOCK_SPEEDS[0];
  const pendingEvents = new Map<string, ScheduledEvent & { onDue: EventListener }>();

  function peekNextEvent(): ScheduledEvent | undefined {
    let earliest: ScheduledEvent | undefined;
    for (const event of pendingEvents.values()) {
      if (!earliest || event.dueAt < earliest.dueAt) {
        earliest = event;
      }
    }
    return earliest && { id: earliest.id, dueAt: earliest.dueAt };
  }

  function fireEventsDueBy(time: number): void {
    const due = [...pendingEvents.values()]
      .filter((event) => event.dueAt <= time)
      .sort((a, b) => a.dueAt - b.dueAt);
    for (const event of due) {
      pendingEvents.delete(event.id);
      event.onDue({ id: event.id, dueAt: event.dueAt });
    }
  }

  function advance(deltaMs: number): void {
    if (deltaMs < 0) {
      throw new Error(`Cannot advance simulated time by a negative amount (${deltaMs}ms).`);
    }
    currentTime += deltaMs;
    fireEventsDueBy(currentTime);
  }

  function advanceToNextEvent(): void {
    const next = peekNextEvent();
    if (!next) {
      return;
    }
    currentTime = next.dueAt;
    fireEventsDueBy(currentTime);
  }

  function schedule(event: ScheduledEvent, onDue: EventListener): void {
    if (pendingEvents.has(event.id)) {
      throw new Error(`An event with id "${event.id}" is already scheduled.`);
    }
    if (event.dueAt < currentTime) {
      throw new Error(
        `Cannot schedule event "${event.id}" in the past (dueAt=${event.dueAt}, now=${currentTime}).`,
      );
    }
    pendingEvents.set(event.id, { ...event, onDue });
  }

  function cancel(eventId: string): void {
    pendingEvents.delete(eventId);
  }

  return {
    now: () => currentTime,
    isPlaying: () => playing,
    speed: () => currentSpeed,
    play: () => {
      playing = true;
    },
    pause: () => {
      playing = false;
    },
    setSpeed: (speed) => {
      if (!CLOCK_SPEEDS.includes(speed)) {
        throw new Error(
          `Invalid clock speed: ${speed}. Must be one of ${CLOCK_SPEEDS.join(', ')}.`,
        );
      }
      currentSpeed = speed;
    },
    advance,
    advanceToNextEvent,
    schedule,
    cancel,
    peekNextEvent,
  };
}
