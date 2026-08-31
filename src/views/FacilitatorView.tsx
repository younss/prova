// Facilitator role view (spec §4.4, §5.1, §5.2, §5.4, §6): clock controls, "Nouveau dossier",
// reset, and E1/E2/E3 exception injection (docs/plan.md items E/F/G, resolved 2026-08-31). E1/E2
// target a single selected case; E3 is global.
import { useEffect, useState } from 'react';
import { CLOCK_SPEEDS } from '../engine/clock';
import { formatSimulatedDuration } from './formatSimulatedDuration';
import { useCaseStore, useCaseStoreSnapshot, useResetStore } from './useCaseStore';

const REAL_TICK_INTERVAL_MS = 200;

export interface FacilitatorViewProps {
  readonly userId: string;
}

export function FacilitatorView({ userId }: FacilitatorViewProps) {
  const store = useCaseStore();
  const snapshot = useCaseStoreSnapshot();
  const resetStore = useResetStore();
  const exceptions = store.getScenarioExceptions();
  const stepLabelsById = new Map(store.getScenarioSteps().map((step) => [step.id, step.label]));
  const [targetedCaseId, setTargetedCaseId] = useState<string>('');
  const [exceptionError, setExceptionError] = useState<string | undefined>(undefined);

  const targetedCase = snapshot.cases.find((record) => record.id === targetedCaseId);
  const canInjectE1 = targetedCase?.state.stepId === 'external-expertise';
  const canInjectE2 = targetedCase?.state.stepId === 'evaluation';

  function runInjection(action: () => void): void {
    try {
      action();
      setExceptionError(undefined);
    } catch (error) {
      setExceptionError(error instanceof Error ? error.message : String(error));
    }
  }

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
        <h3>Injection d'exceptions</h3>
        {exceptionError && <p role="alert">{exceptionError}</p>}

        <div className="form-field">
          <label htmlFor="exception-target-case">Dossier ciblé (pour E1, E2)</label>
          <select
            id="exception-target-case"
            value={targetedCaseId}
            onChange={(event) => setTargetedCaseId(event.target.value)}
          >
            <option value="">— Choisir un dossier —</option>
            {snapshot.cases.map((record) => (
              <option key={record.id} value={record.id}>
                {record.id} — {stepLabelsById.get(record.state.stepId) ?? record.state.stepId}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!canInjectE1}
          title={exceptions.find((exception) => exception.id === 'E1')?.description}
          onClick={() => runInjection(() => store.injectExceptionE1(targetedCaseId, userId))}
        >
          E1 — Timeout expert externe
        </button>
        <button
          type="button"
          disabled={!canInjectE2}
          title={exceptions.find((exception) => exception.id === 'E2')?.description}
          onClick={() => runInjection(() => store.injectExceptionE2(targetedCaseId, userId))}
        >
          E2 — Documents illisibles
        </button>
        <button
          type="button"
          title={exceptions.find((exception) => exception.id === 'E3')?.description}
          onClick={() => runInjection(() => store.injectExceptionE3())}
        >
          E3 — Pic de volume (8 dossiers)
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
