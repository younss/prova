// Declarative water-damage scenario (spec §3, §7): the ONLY place that owns this scenario's
// steps, thresholds, and decision rules. The engine (src/engine/) never hardcodes any of this —
// changing a threshold here changes behavior with zero engine changes (spec §7, AC7).
import type {
  ScenarioDecisionRule,
  ScenarioDefinition,
  ScenarioException,
  ScenarioStep,
} from './types';

export interface WaterDamageCaseContext {
  readonly coverageValid: boolean;
  /** 0–100 complexity score assigned at the "triage" step. */
  readonly complexityScore: number;
  readonly proposedAmountDollars: number;
}

export interface WaterDamageThresholds {
  readonly complexityScoreRequiringExpertise: number;
  readonly amountRequiringSupervisorApprovalDollars: number;
}

/** Named data values behind spec §3's decision rules — never inline magic numbers in guards. */
export const DEFAULT_WATER_DAMAGE_THRESHOLDS: WaterDamageThresholds = {
  complexityScoreRequiringExpertise: 70,
  amountRequiringSupervisorApprovalDollars: 10_000,
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const WATER_DAMAGE_STEPS: readonly ScenarioStep[] = [
  {
    id: 'declaration',
    label: 'Déclaration du sinistre',
    actorRole: 'Client',
    actorType: 'human',
    simulatedDurationMs: 10 * MINUTE_MS,
  },
  {
    id: 'triage',
    label: 'Tri automatique + score de complexité',
    actorRole: 'Agent IA « Triage »',
    actorType: 'automated',
    simulatedDurationMs: 30 * 1000,
  },
  {
    id: 'coverage-check',
    label: 'Vérification de couverture',
    actorRole: 'Moteur de règles',
    actorType: 'automated',
    simulatedDurationMs: 5 * 1000,
  },
  {
    id: 'evaluation',
    label: 'Évaluation du dossier',
    actorRole: 'Analyste sinistres',
    actorType: 'human',
    simulatedDurationMs: 4 * HOUR_MS,
  },
  {
    id: 'external-expertise',
    label: "Demande d'expertise externe",
    actorRole: 'Expert externe',
    actorType: 'third-party-async',
    simulatedDurationMs: 3 * DAY_MS,
  },
  {
    id: 'settlement-proposal',
    label: "Proposition d'indemnisation",
    actorRole: 'Analyste sinistres',
    actorType: 'human',
    simulatedDurationMs: HOUR_MS,
  },
  {
    id: 'supervisor-approval',
    label: 'Approbation seconde signature',
    actorRole: 'Superviseur',
    actorType: 'human',
    simulatedDurationMs: 2 * HOUR_MS,
  },
  {
    id: 'payment',
    label: 'Notification et paiement',
    actorRole: 'Système',
    actorType: 'automated',
    simulatedDurationMs: MINUTE_MS,
  },
  {
    id: 'rejected',
    label: 'Réclamation rejetée (couverture invalide)',
    actorRole: 'Moteur de règles',
    actorType: 'automated',
    simulatedDurationMs: 0,
  },
] as const;

/**
 * Injectable exceptions (spec §3, §5.4). Only their identity/labels are declarative data here —
 * their effects on a running case are Phase 5's exception-effects schema (open questions E/F/G).
 */
export const WATER_DAMAGE_EXCEPTIONS: readonly ScenarioException[] = [
  {
    id: 'E1',
    label: "Timeout de l'expert externe",
    description: "L'expert externe ne répond pas dans les 5 jours simulés → escalade automatique.",
  },
  {
    id: 'E2',
    label: 'Documents illisibles',
    description: 'Les documents fournis sont illisibles → boucle de retouche vers le client.',
  },
  {
    id: 'E3',
    label: 'Pic de volume',
    description: "8 dossiers arrivent d'un coup dans la file de l'analyste.",
  },
];

export function createWaterDamageScenario(
  thresholds: WaterDamageThresholds = DEFAULT_WATER_DAMAGE_THRESHOLDS,
): ScenarioDefinition<WaterDamageCaseContext> {
  const coverageIsInvalid = (context: WaterDamageCaseContext): boolean => !context.coverageValid;

  const requiresExternalExpertise = (context: WaterDamageCaseContext): boolean =>
    context.complexityScore > thresholds.complexityScoreRequiringExpertise;

  const requiresSupervisorApproval = (context: WaterDamageCaseContext): boolean =>
    context.proposedAmountDollars > thresholds.amountRequiringSupervisorApprovalDollars;

  const decisionRules: ScenarioDecisionRule<WaterDamageCaseContext>[] = [
    {
      id: 'invalid-coverage-rejection',
      description: 'Couverture invalide → rejet motivé à l’étape 3, fin du flux.',
      guard: coverageIsInvalid,
    },
    {
      id: 'complexity-requires-expertise',
      description: `Score de complexité > ${thresholds.complexityScoreRequiringExpertise} → passage obligatoire par l’étape 5 (expertise externe).`,
      guard: requiresExternalExpertise,
    },
    {
      id: 'amount-requires-supervisor-approval',
      description: `Montant proposé > ${thresholds.amountRequiringSupervisorApprovalDollars} $ → étape 7 obligatoire (séparation des tâches).`,
      guard: requiresSupervisorApproval,
    },
  ];

  return {
    id: 'water-damage-claim',
    title: 'Réclamation d’assurance habitation — dégât d’eau',
    initialStepId: 'declaration',
    steps: WATER_DAMAGE_STEPS,
    decisionRules,
    exceptions: WATER_DAMAGE_EXCEPTIONS,
    transitions: [
      { id: 'submit-declaration', from: 'declaration', to: 'triage' },
      { id: 'complete-triage', from: 'triage', to: 'coverage-check' },
      {
        id: 'coverage-valid',
        from: 'coverage-check',
        to: 'evaluation',
        guard: (context) => !coverageIsInvalid(context),
      },
      { id: 'coverage-invalid', from: 'coverage-check', to: 'rejected', guard: coverageIsInvalid },
      {
        id: 'evaluation-requires-expertise',
        from: 'evaluation',
        to: 'external-expertise',
        guard: requiresExternalExpertise,
      },
      {
        id: 'evaluation-skips-expertise',
        from: 'evaluation',
        to: 'settlement-proposal',
        guard: (context) => !requiresExternalExpertise(context),
      },
      { id: 'expertise-received', from: 'external-expertise', to: 'settlement-proposal' },
      {
        id: 'proposal-requires-supervisor',
        from: 'settlement-proposal',
        to: 'supervisor-approval',
        guard: requiresSupervisorApproval,
      },
      {
        id: 'proposal-skips-supervisor',
        from: 'settlement-proposal',
        to: 'payment',
        guard: (context) => !requiresSupervisorApproval(context),
      },
      { id: 'supervisor-approves', from: 'supervisor-approval', to: 'payment' },
    ],
  };
}
