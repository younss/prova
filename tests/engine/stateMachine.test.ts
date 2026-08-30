import { describe, expect, it } from 'vitest';
import {
  applyTransition,
  createCase,
  getAvailableTransitions,
  type StateMachineDefinition,
} from '../../src/engine/stateMachine';

interface DraftContext {
  readonly wordCount: number;
}

// Dummy 2–3-step fixture (draft -> review -> done), independent of any real scenario content.
const draftReviewDone: StateMachineDefinition<DraftContext> = {
  initialStepId: 'draft',
  steps: [{ id: 'draft' }, { id: 'review' }, { id: 'done' }],
  transitions: [
    {
      id: 'submit-for-review',
      from: 'draft',
      to: 'review',
      guard: (context) => context.wordCount > 0,
    },
    { id: 'approve', from: 'review', to: 'done' },
    { id: 'reject', from: 'review', to: 'draft' },
  ],
};

describe('createCase', () => {
  it('starts at the definition initial step, with history seeded to it', () => {
    const state = createCase(draftReviewDone, { wordCount: 10 });

    expect(state.stepId).toBe('draft');
    expect(state.history).toEqual(['draft']);
  });

  it('rejects a definition whose initial step is not among its steps', () => {
    const broken: StateMachineDefinition = {
      initialStepId: 'missing',
      steps: [{ id: 'draft' }],
      transitions: [],
    };

    expect(() => createCase(broken, {})).toThrow(/Initial step/);
  });

  it('rejects a definition with duplicate step ids', () => {
    const broken: StateMachineDefinition = {
      initialStepId: 'draft',
      steps: [{ id: 'draft' }, { id: 'draft' }],
      transitions: [],
    };

    expect(() => createCase(broken, {})).toThrow(/duplicate step ids/);
  });

  it('rejects a transition whose "to" references an unknown step', () => {
    const broken: StateMachineDefinition = {
      initialStepId: 'draft',
      steps: [{ id: 'draft' }],
      transitions: [{ id: 't', from: 'draft', to: 'nowhere' }],
    };

    expect(() => createCase(broken, {})).toThrow(/unknown step "nowhere"/);
  });

  it('rejects a transition whose "from" references an unknown step', () => {
    const broken: StateMachineDefinition = {
      initialStepId: 'draft',
      steps: [{ id: 'draft' }],
      transitions: [{ id: 't', from: 'nowhere', to: 'draft' }],
    };

    expect(() => createCase(broken, {})).toThrow(/unknown step "nowhere"/);
  });

  it('rejects a definition with duplicate transition ids', () => {
    const broken: StateMachineDefinition = {
      initialStepId: 'draft',
      steps: [{ id: 'draft' }, { id: 'review' }],
      transitions: [
        { id: 'dup', from: 'draft', to: 'review' },
        { id: 'dup', from: 'review', to: 'draft' },
      ],
    };

    expect(() => createCase(broken, {})).toThrow(/Duplicate transition id "dup"/);
  });
});

describe('getAvailableTransitions', () => {
  it('returns only transitions leaving the current step', () => {
    const state = createCase(draftReviewDone, { wordCount: 10 });

    const available = getAvailableTransitions(draftReviewDone, state);

    expect(available.map((t) => t.id)).toEqual(['submit-for-review']);
  });

  it('excludes transitions whose guard rejects the current context', () => {
    const state = createCase(draftReviewDone, { wordCount: 0 });

    const available = getAvailableTransitions(draftReviewDone, state);

    expect(available).toEqual([]);
  });

  it('includes transitions with no guard unconditionally', () => {
    const inReview = { stepId: 'review', context: { wordCount: 10 }, history: ['draft', 'review'] };

    const available = getAvailableTransitions(draftReviewDone, inReview);

    expect(available.map((t) => t.id).sort()).toEqual(['approve', 'reject']);
  });
});

describe('applyTransition', () => {
  it('moves the case to the transition target step and appends to history', () => {
    const state = createCase(draftReviewDone, { wordCount: 10 });

    const next = applyTransition(draftReviewDone, state, 'submit-for-review');

    expect(next.stepId).toBe('review');
    expect(next.history).toEqual(['draft', 'review']);
  });

  it('does not mutate the original state', () => {
    const state = createCase(draftReviewDone, { wordCount: 10 });

    applyTransition(draftReviewDone, state, 'submit-for-review');

    expect(state.stepId).toBe('draft');
    expect(state.history).toEqual(['draft']);
  });

  it('rejects an unknown transition id', () => {
    const state = createCase(draftReviewDone, { wordCount: 10 });

    expect(() => applyTransition(draftReviewDone, state, 'does-not-exist')).toThrow(
      /Unknown transition/,
    );
  });

  it('rejects a transition that does not start from the current step', () => {
    const state = createCase(draftReviewDone, { wordCount: 10 });

    expect(() => applyTransition(draftReviewDone, state, 'approve')).toThrow(
      /starts from step "review"/,
    );
  });

  it('rejects a transition whose guard rejects the current context', () => {
    const state = createCase(draftReviewDone, { wordCount: 0 });

    expect(() => applyTransition(draftReviewDone, state, 'submit-for-review')).toThrow(
      /guard rejected/,
    );
  });
});
