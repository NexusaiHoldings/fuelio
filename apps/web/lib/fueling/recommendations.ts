/**
 * AI-powered workout-phase fueling recommendation engine.
 *
 * Uses Claude Sonnet with sports-science-bounded system prompts to generate
 * pre-workout, intra-workout, and recovery fueling guidance.
 *
 * Outputs are constrained to pre-validated carbohydrate and protein timing
 * ranges (autonomous_operation_score: 58) and framed as general educational
 * information per COO regulatory direction.
 */

import {
  classifyEALevel,
  getBoundsForWorkout,
  getAllBoundsForWorkout,
  requiresIntraFueling,
  type EALevel,
  type WorkoutType,
  type WorkoutPhase,
  type PhaseBounds,
} from "./sports-science-bounds";
import {
  wrapWithCompliance,
  getComplianceSystemPromptAddendum,
  type ComplianceWrapped,
} from "./compliance-wrapper";

export interface WorkoutInput {
  readonly workoutId: string;
  readonly workoutType: WorkoutType;
  readonly durationMinutes: number;
  readonly scheduledAt: string;
  readonly intensityPercent: number;
  readonly athleteWeightKg: number;
  readonly eaScore: number;
  readonly athleteName?: string;
}

export interface PhaseRecommendation {
  readonly phase: WorkoutPhase;
  readonly carbGramsRange: readonly [number, number];
  readonly proteinGramsRange: readonly [number, number];
  readonly fluidMlRange: readonly [number, number];
  readonly timingDescription: string;
  readonly suggestedFoods: readonly string[];
  readonly keyNotes: string;
  readonly rationaleSummary: string;
}

export interface WorkoutFuelingPlan {
  readonly workoutId: string;
  readonly workoutType: WorkoutType;
  readonly durationMinutes: number;
  readonly eaLevel: EALevel;
  readonly eaScore: number;
  readonly redSAlert: boolean;
  readonly pre: PhaseRecommendation;
  readonly intra: PhaseRecommendation | null;
  readonly post: PhaseRecommendation;
  readonly generatedAt: string;
}

export type WrappedFuelingPlan = ComplianceWrapped<WorkoutFuelingPlan>;

interface AnthropicMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface AnthropicResponse {
  readonly content: ReadonlyArray<{ readonly type: string; readonly text: string }>;
}

function buildSystemPrompt(input: WorkoutInput, eaLevel: EALevel): string {
  const bounds = getAllBoundsForWorkout(input.workoutType);
  const includeIntra = requiresIntraFueling(input.workoutType, input.durationMinutes);

  const formatBounds = (phase: WorkoutPhase): string => {
    const b: PhaseBounds = bounds[phase];
    return [
      `  CHO: ${b.carbohydrate.minGPerKg}–${b.carbohydrate.maxGPerKg} g/kg bodyweight`,
      `  Protein: ${b.protein.minGPerKg}–${b.protein.maxGPerKg} g/kg bodyweight`,
      `  Fluid: ${b.fluidMlPerKg.minGPerKg}–${b.fluidMlPerKg.maxGPerKg} ml/kg bodyweight`,
      `  Timing: ${b.timing.description}`,
      b.intraGCHOPerHour
        ? `  Intra-session CHO rate: ${b.intraGCHOPerHour[0]}–${b.intraGCHOPerHour[1]} g/hour`
        : "",
      `  Rationale: ${b.rationaleSummary}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const eaWarning =
    eaLevel === "very_low"
      ? "\nCRITICAL: Athlete's EA score is below 30 kcal/kg FFM/day — very low EA, high RED-S risk. You MUST include a clear RED-S alert and strongly recommend evaluation by a sports medicine physician."
      : eaLevel === "low"
        ? "\nNOTE: Athlete's EA score is in the low EA range (30–44 kcal/kg FFM/day). Flag this and suggest the athlete discuss energy intake with a sports dietitian."
        : "";

  return [
    "You are a sports nutrition information system that generates general fueling guidelines based on published consensus evidence.",
    "",
    getComplianceSystemPromptAddendum(),
    "",
    "EVIDENCE-BASED BOUNDS — your recommendations MUST stay within these ranges:",
    `Workout type: ${input.workoutType} | Duration: ${input.durationMinutes} min | Intensity: ${input.intensityPercent}%`,
    `Athlete weight: ${input.athleteWeightKg} kg | EA score: ${input.eaScore} kcal/kg FFM/day (${eaLevel} EA)`,
    "",
    "PRE-WORKOUT BOUNDS:",
    formatBounds("pre"),
    "",
    ...(includeIntra
      ? ["INTRA-WORKOUT BOUNDS:", formatBounds("intra"), ""]
      : ["(No intra-workout fueling required for this session length/type)", ""]),
    "POST-WORKOUT BOUNDS:",
    formatBounds("post"),
    eaWarning,
    "",
    'OUTPUT FORMAT: Respond with a valid JSON object matching this exact shape (no markdown, no code fences):',
    "{",
    '  "pre": { "carbGramsRange": [min, max], "proteinGramsRange": [min, max], "fluidMlRange": [min, max], "timingDescription": "string", "suggestedFoods": ["food1", "food2"], "keyNotes": "string" },',
    includeIntra
      ? '  "intra": { "carbGramsRange": [min, max], "proteinGramsRange": [0, 0], "fluidMlRange": [min, max], "timingDescription": "string", "suggestedFoods": ["food1"], "keyNotes": "string" },'
      : '  "intra": null,',
    '  "post": { "carbGramsRange": [min, max], "proteinGramsRange": [min, max], "fluidMlRange": [min, max], "timingDescription": "string", "suggestedFoods": ["food1", "food2"], "keyNotes": "string" },',
    '  "redSAlert": false',
    "}",
  ].join("\n");
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const messages: AnthropicMessage[] = [{ role: "user", content: userMessage }];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const textBlock = data.content.find((c) => c.type === "text");
  if (!textBlock) {
    throw new Error("No text content in Anthropic API response");
  }
  return textBlock.text;
}

function computeGramsFromBounds(
  bounds: PhaseBounds,
  weightKg: number,
): { carb: readonly [number, number]; protein: readonly [number, number]; fluid: readonly [number, number] } {
  return {
    carb: [
      Math.round(bounds.carbohydrate.minGPerKg * weightKg),
      Math.round(bounds.carbohydrate.maxGPerKg * weightKg),
    ],
    protein: [
      Math.round(bounds.protein.minGPerKg * weightKg),
      Math.round(bounds.protein.maxGPerKg * weightKg),
    ],
    fluid: [
      Math.round(bounds.fluidMlPerKg.minGPerKg * weightKg),
      Math.round(bounds.fluidMlPerKg.maxGPerKg * weightKg),
    ],
  };
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateAndClampPhaseOutput(
  parsed: {
    carbGramsRange: number[];
    proteinGramsRange: number[];
    fluidMlRange: number[];
    timingDescription: string;
    suggestedFoods: string[];
    keyNotes: string;
  },
  bounds: PhaseBounds,
  weightKg: number,
  phase: WorkoutPhase,
): PhaseRecommendation {
  const computed = computeGramsFromBounds(bounds, weightKg);

  const carbMin = clampToRange(parsed.carbGramsRange[0] ?? computed.carb[0], computed.carb[0], computed.carb[1]);
  const carbMax = clampToRange(parsed.carbGramsRange[1] ?? computed.carb[1], computed.carb[0], computed.carb[1]);
  const protMin = clampToRange(parsed.proteinGramsRange[0] ?? computed.protein[0], computed.protein[0], computed.protein[1]);
  const protMax = clampToRange(parsed.proteinGramsRange[1] ?? computed.protein[1], computed.protein[0], computed.protein[1]);
  const fluidMin = clampToRange(parsed.fluidMlRange[0] ?? computed.fluid[0], computed.fluid[0], computed.fluid[1]);
  const fluidMax = clampToRange(parsed.fluidMlRange[1] ?? computed.fluid[1], computed.fluid[0], computed.fluid[1]);

  return {
    phase,
    carbGramsRange: [carbMin, carbMax],
    proteinGramsRange: [protMin, protMax],
    fluidMlRange: [fluidMin, fluidMax],
    timingDescription: parsed.timingDescription || bounds.timing.description,
    suggestedFoods: Array.isArray(parsed.suggestedFoods) ? parsed.suggestedFoods.slice(0, 5) : [],
    keyNotes: parsed.keyNotes || "",
    rationaleSummary: bounds.rationaleSummary,
  };
}

export async function generateFuelingPlan(input: WorkoutInput): Promise<WrappedFuelingPlan> {
  const eaLevel = classifyEALevel(input.eaScore);
  const includeIntra = requiresIntraFueling(input.workoutType, input.durationMinutes);
  const systemPrompt = buildSystemPrompt(input, eaLevel);

  const userMessage = [
    `Please generate fueling guidelines for this workout session:`,
    `- Type: ${input.workoutType}`,
    `- Duration: ${input.durationMinutes} minutes`,
    `- Intensity: ${input.intensityPercent}%`,
    `- Scheduled: ${input.scheduledAt}`,
    `- Athlete weight: ${input.athleteWeightKg} kg`,
    `- Energy Availability: ${input.eaScore} kcal/kg FFM/day`,
    "",
    "Provide specific gram targets within the evidence-based bounds. Suggest 3–5 practical whole-food options for each phase.",
  ].join("\n");

  let parsedResponse: {
    pre: {
      carbGramsRange: number[];
      proteinGramsRange: number[];
      fluidMlRange: number[];
      timingDescription: string;
      suggestedFoods: string[];
      keyNotes: string;
    };
    intra: {
      carbGramsRange: number[];
      proteinGramsRange: number[];
      fluidMlRange: number[];
      timingDescription: string;
      suggestedFoods: string[];
      keyNotes: string;
    } | null;
    post: {
      carbGramsRange: number[];
      proteinGramsRange: number[];
      fluidMlRange: number[];
      timingDescription: string;
      suggestedFoods: string[];
      keyNotes: string;
    };
    redSAlert: boolean;
  };

  try {
    const rawText = await callClaude(systemPrompt, userMessage);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in Claude response");
    parsedResponse = JSON.parse(jsonMatch[0]) as typeof parsedResponse;
  } catch (err) {
    const computed = computeGramsFromBounds(getBoundsForWorkout(input.workoutType, "pre"), input.athleteWeightKg);
    parsedResponse = {
      pre: {
        carbGramsRange: [computed.carb[0], computed.carb[1]],
        proteinGramsRange: [computed.protein[0], computed.protein[1]],
        fluidMlRange: [computed.fluid[0], computed.fluid[1]],
        timingDescription: getBoundsForWorkout(input.workoutType, "pre").timing.description,
        suggestedFoods: ["oats", "banana", "rice cakes", "sports drink", "yogurt"],
        keyNotes: "Evidence-based default ranges applied.",
      },
      intra: includeIntra
        ? (() => {
            const ic = computeGramsFromBounds(getBoundsForWorkout(input.workoutType, "intra"), input.athleteWeightKg);
            return {
              carbGramsRange: [ic.carb[0], ic.carb[1]],
              proteinGramsRange: [0, 0],
              fluidMlRange: [ic.fluid[0], ic.fluid[1]],
              timingDescription: getBoundsForWorkout(input.workoutType, "intra").timing.description,
              suggestedFoods: ["sports gel", "banana", "sports drink"],
              keyNotes: "Evidence-based default ranges applied.",
            };
          })()
        : null,
      post: (() => {
        const pc = computeGramsFromBounds(getBoundsForWorkout(input.workoutType, "post"), input.athleteWeightKg);
        return {
          carbGramsRange: [pc.carb[0], pc.carb[1]],
          proteinGramsRange: [pc.protein[0], pc.protein[1]],
          fluidMlRange: [pc.fluid[0], pc.fluid[1]],
          timingDescription: getBoundsForWorkout(input.workoutType, "post").timing.description,
          suggestedFoods: ["chocolate milk", "rice + chicken", "Greek yogurt + fruit", "recovery shake"],
          keyNotes: "Evidence-based default ranges applied.",
        };
      })(),
      redSAlert: eaLevel === "very_low",
    };
    console.error("[fueling/recommendations] Claude API fallback:", err instanceof Error ? err.message : String(err));
  }

  const preBounds = getBoundsForWorkout(input.workoutType, "pre");
  const intraBounds = getBoundsForWorkout(input.workoutType, "intra");
  const postBounds = getBoundsForWorkout(input.workoutType, "post");

  const plan: WorkoutFuelingPlan = {
    workoutId: input.workoutId,
    workoutType: input.workoutType,
    durationMinutes: input.durationMinutes,
    eaLevel,
    eaScore: input.eaScore,
    redSAlert: parsedResponse.redSAlert || eaLevel === "very_low",
    pre: validateAndClampPhaseOutput(parsedResponse.pre, preBounds, input.athleteWeightKg, "pre"),
    intra:
      includeIntra && parsedResponse.intra
        ? validateAndClampPhaseOutput(parsedResponse.intra, intraBounds, input.athleteWeightKg, "intra")
        : null,
    post: validateAndClampPhaseOutput(parsedResponse.post, postBounds, input.athleteWeightKg, "post"),
    generatedAt: new Date().toISOString(),
  };

  return wrapWithCompliance(plan);
}

export function formatWorkoutTypeLabel(workoutType: WorkoutType): string {
  const labels: Record<WorkoutType, string> = {
    endurance: "Endurance",
    strength: "Strength",
    hiit: "HIIT",
    team_sport: "Team Sport",
    recovery: "Recovery",
  };
  return labels[workoutType];
}

export function formatEALevelLabel(eaLevel: EALevel): string {
  const labels: Record<EALevel, string> = {
    normal: "Normal EA (≥45 kcal/kg FFM/day)",
    low: "Low EA (30–44 kcal/kg FFM/day)",
    very_low: "Very Low EA (<30 kcal/kg FFM/day) — RED-S Risk",
  };
  return labels[eaLevel];
}
