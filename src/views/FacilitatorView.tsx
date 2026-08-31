// Facilitator role view (spec §4.4, §5.1, §5.2, §6): clock controls, "Nouveau dossier", and
// reset. E1/E2/E3 exception injection is deliberately NOT implemented here — their effects are
// open questions E/F/G in docs/plan.md, unresolved, and plan.md explicitly gates that work until
// they're answered.
import { useEffect } from 'react';
import { CLOCK_SPEEDS } from '../engine/clock';
import { formatSimulatedDuration } from './formatSimulatedDuration';
import { useCaseStore, useCaseStoreSnapshot, useResetStore } from './useCaseStore';

const REAL_TICK_INTERVAL_MS = 200;

export function FacilitatorView() {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const resetStore = useResetStore();

  // The real-time pacing driver for "Lecture" mode: paces the simulated clock while playing.
  // Lives here (a React effect), not inside src/engine/ or src/app/, per CLAUDE.md's rule that
  // Date.now()/setInterval never appear inside the engine.
  useEffect(() => {
    const intervalId = setInterval(() => {
      store.tick(REAL_TICK_INTERVAL_MS);
    }, REAL_TICK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [store]);

  return (
    <section aria-labelledby="facilitator-view-title">
      <h2 id="facilitator-view-title">Panneau animateur</h2>

      <div>
        <p>
          Temps simulé écoulé : {formatSimulatedDuration(snapshot.clock.now)} — ×
          {snapshot.clock.speed} ({snapshot.clock.isPlaying ? 'Lecture' : 'Pause'})
        </p>
        <button type="button" onClick={() => store.playClock()} disabled={snapshot.clock.isPlaying}>
          Lecture
        </button>
        <button
          type="button"
          onClick={() => store.pauseClock()}
          disabled={!snapshot.clock.isPlaying}
        >
          Pause
        </button>
        {CLOCK_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={snapshot.clock.speed === speed}
            onClick={() => store.setClockSpeed(speed)}
          >
            ×{speed}
          </button>
        ))}
        <button type="button" onClick={() => store.advanceToNextEvent()}>
          Avancer jusqu'au prochain événement
        </button>
      </div>

      <div>
        <button type="button" onClick={() => store.generateNewCase()}>
          Nouveau dossier
        </button>
      </div>

      <div>
        <button type="button" onClick={resetStore}>
          Réinitialiser le scénario
        </button>
      </div>
    </section>
  );
}
