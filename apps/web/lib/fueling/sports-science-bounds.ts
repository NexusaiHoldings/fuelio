/**
 * Evidence-based carbohydrate, protein, and hydration timing ranges.
 *
 * Sources: ISSN Position Stand 2017, IOC Consensus Statement 2011,
 * Thomas et al. 2016 (ACSM/DC/AND), Burke et al. 2011, Mountjoy et al. 2018 (RED-S).
 *
 * These bounds constrain AI-generated recommendations to pre-validated
 * peer-reviewed ranges (autonomous_operation_score: 58 per feasibility_analysis).
 */

export type WorkoutType = "endurance" | "strength" | "hiit" | "team_sport" | "recovery";
export type WorkoutPhase = "pre" | "intra" | "post";
export type EALevel = "normal" | "low" | "very_low";

export interface NutrientRange {
  readonly minGPerKg: number;
  readonly maxGPerKg: number;
}

export interface TimingWindow {
  readonly minMinutes: number;
  readonly maxMinutes: number;
  readonly description: string;
}

export interface PhaseBounds {
  readonly carbohydrate: NutrientRange;
  readonly protein: NutrientRange;
  readonly fluidMlPerKg: NutrientRange;
  readonly timing: TimingWindow;
  readonly intraGCHOPerHour?: readonly [number, number];
  readonly rationaleSummary: string;
}

export type WorkoutPhaseBoundsMap = Record<WorkoutPhase, PhaseBounds>;

export const EA_THRESHOLDS = {
  NORMAL: 45,
  LOW: 30,
} as const;

export function classifyEALevel(eaScore: number): EALevel {
  if (eaScore >= EA_THRESHOLDS.NORMAL) return "normal";
  if (eaScore >= EA_THRESHOLDS.LOW) return "low";
  return "very_low";
}

const ENDURANCE_BOUNDS: WorkoutPhaseBoundsMap = {
  pre: {
    carbohydrate: { minGPerKg: 1.0, maxGPerKg: 4.0 },
    protein: { minGPerKg: 0.15, maxGPerKg: 0.25 },
    fluidMlPerKg: { minGPerKg: 5, maxGPerKg: 10 },
    timing: { minMinutes: 60, maxMinutes: 240, description: "1–4 hours before exercise" },
    rationaleSummary: "CHO loading maximises muscle glycogen; protein primes MPS without GI distress.",
  },
  intra: {
    carbohydrate: { minGPerKg: 0.5, maxGPerKg: 1.0 },
    protein: { minGPerKg: 0, maxGPerKg: 0 },
    fluidMlPerKg: { minGPerKg: 4, maxGPerKg: 8 },
    timing: { minMinutes: 0, maxMinutes: 60, description: "Every 45–60 min during exercise" },
    intraGCHOPerHour: [30, 90],
    rationaleSummary: "Multi-transport CHO (glucose+fructose) at 2:1 ratio for sessions >90 min.",
  },
  post: {
    carbohydrate: { minGPerKg: 1.0, maxGPerKg: 1.5 },
    protein: { minGPerKg: 0.25, maxGPerKg: 0.4 },
    fluidMlPerKg: { minGPerKg: 6, maxGPerKg: 10 },
    timing: { minMinutes: 0, maxMinutes: 30, description: "Within 30 min post-exercise" },
    rationaleSummary: "Rapid glycogen resynthesis window; protein targets 20–40 g for MPS.",
  },
};

const STRENGTH_BOUNDS: WorkoutPhaseBoundsMap = {
  pre: {
    carbohydrate: { minGPerKg: 0.5, maxGPerKg: 1.5 },
    protein: { minGPerKg: 0.2, maxGPerKg: 0.4 },
    fluidMlPerKg: { minGPerKg: 5, maxGPerKg: 8 },
    timing: { minMinutes: 30, maxMinutes: 120, description: "30 min–2 hours before exercise" },
    rationaleSummary: "Moderate CHO sustains performance; elevated pre-workout protein augments MPS.",
  },
  intra: {
    carbohydrate: { minGPerKg: 0, maxGPerKg: 0.3 },
    protein: { minGPerKg: 0, maxGPerKg: 0 },
    fluidMlPerKg: { minGPerKg: 2, maxGPerKg: 5 },
    timing: { minMinutes: 0, maxMinutes: 30, description: "As needed during session" },
    rationaleSummary: "Intra-session needs modest; hydration is primary concern.",
  },
  post: {
    carbohydrate: { minGPerKg: 0.5, maxGPerKg: 1.0 },
    protein: { minGPerKg: 0.3, maxGPerKg: 0.5 },
    fluidMlPerKg: { minGPerKg: 5, maxGPerKg: 8 },
    timing: { minMinutes: 0, maxMinutes: 60, description: "Within 60 min post-exercise" },
    rationaleSummary: "Protein priority for MPS; CHO supports recovery and anabolic insulin response.",
  },
};

const HIIT_BOUNDS: WorkoutPhaseBoundsMap = {
  pre: {
    carbohydrate: { minGPerKg: 0.5, maxGPerKg: 2.0 },
    protein: { minGPerKg: 0.15, maxGPerKg: 0.3 },
    fluidMlPerKg: { minGPerKg: 5, maxGPerKg: 10 },
    timing: { minMinutes: 60, maxMinutes: 180, description: "1–3 hours before exercise" },
    rationaleSummary: "HIIT taxes fast-glycolytic pathways; CHO availability is critical.",
  },
  intra: {
    carbohydrate: { minGPerKg: 0.2, maxGPerKg: 0.5 },
    protein: { minGPerKg: 0, maxGPerKg: 0 },
    fluidMlPerKg: { minGPerKg: 3, maxGPerKg: 6 },
    timing: { minMinutes: 0, maxMinutes: 20, description: "During rest intervals" },
    intraGCHOPerHour: [20, 40],
    rationaleSummary: "Small carb doses maintain blood glucose during high-intensity intervals.",
  },
  post: {
    carbohydrate: { minGPerKg: 0.8, maxGPerKg: 1.2 },
    protein: { minGPerKg: 0.25, maxGPerKg: 0.4 },
    fluidMlPerKg: { minGPerKg: 6, maxGPerKg: 10 },
    timing: { minMinutes: 0, maxMinutes: 30, description: "Within 30 min post-exercise" },
    rationaleSummary: "HIIT depletes glycogen rapidly; aggressive post-workout window is prioritised.",
  },
};

const TEAM_SPORT_BOUNDS: WorkoutPhaseBoundsMap = {
  pre: {
    carbohydrate: { minGPerKg: 1.0, maxGPerKg: 3.0 },
    protein: { minGPerKg: 0.15, maxGPerKg: 0.25 },
    fluidMlPerKg: { minGPerKg: 5, maxGPerKg: 10 },
    timing: { minMinutes: 60, maxMinutes: 240, description: "1–4 hours before exercise" },
    rationaleSummary: "Intermittent high-intensity demands require adequate glycogen stores.",
  },
  intra: {
    carbohydrate: { minGPerKg: 0.3, maxGPerKg: 0.7 },
    protein: { minGPerKg: 0, maxGPerKg: 0 },
    fluidMlPerKg: { minGPerKg: 4, maxGPerKg: 8 },
    timing: { minMinutes: 0, maxMinutes: 30, description: "At breaks/half-time" },
    intraGCHOPerHour: [30, 60],
    rationaleSummary: "CHO and fluid replacement at structured breaks sustains second-half performance.",
  },
  post: {
    carbohydrate: { minGPerKg: 1.0, maxGPerKg: 1.5 },
    protein: { minGPerKg: 0.25, maxGPerKg: 0.4 },
    fluidMlPerKg: { minGPerKg: 6, maxGPerKg: 10 },
    timing: { minMinutes: 0, maxMinutes: 30, description: "Within 30 min post-exercise" },
    rationaleSummary: "Prioritise rapid glycogen resynthesis for tournament/multi-day schedules.",
  },
};

const RECOVERY_BOUNDS: WorkoutPhaseBoundsMap = {
  pre: {
    carbohydrate: { minGPerKg: 0.5, maxGPerKg: 1.0 },
    protein: { minGPerKg: 0.15, maxGPerKg: 0.25 },
    fluidMlPerKg: { minGPerKg: 4, maxGPerKg: 7 },
    timing: { minMinutes: 30, maxMinutes: 120, description: "30 min–2 hours before exercise" },
    rationaleSummary: "Light session; small CHO primes movement without GI overload.",
  },
  intra: {
    carbohydrate: { minGPerKg: 0, maxGPerKg: 0 },
    protein: { minGPerKg: 0, maxGPerKg: 0 },
    fluidMlPerKg: { minGPerKg: 2, maxGPerKg: 4 },
    timing: { minMinutes: 0, maxMinutes: 60, description: "Ad libitum during session" },
    rationaleSummary: "Hydration only for low-intensity recovery sessions.",
  },
  post: {
    carbohydrate: { minGPerKg: 0.3, maxGPerKg: 0.8 },
    protein: { minGPerKg: 0.2, maxGPerKg: 0.35 },
    fluidMlPerKg: { minGPerKg: 4, maxGPerKg: 8 },
    timing: { minMinutes: 0, maxMinutes: 90, description: "Within 90 min post-exercise" },
    rationaleSummary: "Modest post-session nutrition; recovery session demands are low.",
  },
};

const BOUNDS_BY_TYPE: Record<WorkoutType, WorkoutPhaseBoundsMap> = {
  endurance: ENDURANCE_BOUNDS,
  strength: STRENGTH_BOUNDS,
  hiit: HIIT_BOUNDS,
  team_sport: TEAM_SPORT_BOUNDS,
  recovery: RECOVERY_BOUNDS,
};

export function getBoundsForWorkout(
  workoutType: WorkoutType,
  phase: WorkoutPhase,
): PhaseBounds {
  return BOUNDS_BY_TYPE[workoutType][phase];
}

export function getAllBoundsForWorkout(workoutType: WorkoutType): WorkoutPhaseBoundsMap {
  return BOUNDS_BY_TYPE[workoutType];
}

export function requiresIntraFueling(
  workoutType: WorkoutType,
  durationMinutes: number,
): boolean {
  if (workoutType === "recovery") return false;
  if (workoutType === "strength" && durationMinutes < 75) return false;
  return durationMinutes >= 60;
}
