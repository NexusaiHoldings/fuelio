/**
 * Safety flag detection for disordered eating patterns.
 *
 * Per liability_assessor: human_in_loop_required_for these detections.
 * Flags are surfaced to the athlete dashboard and coach view; they do NOT
 * trigger automated interventions. A human (coach or clinician) must review.
 *
 * Detects:
 *   - Critically low caloric intake (< 1000 kcal/day)
 *   - Rapid calorie restriction (> 40% drop vs 7-day average)
 *   - Consecutive days of extreme restriction (≥ 3 days < 1200 kcal)
 *   - Meal skipping patterns (0 intake on workout days)
 *   - Severe EA deficit (EA < 15 kcal/kg FFM/day)
 */

import { buildDb } from "@/lib/db";
import { LEA_THRESHOLD_KCAL_PER_KG } from "./energy-availability";

export type SafetyFlagSeverity = "warning" | "alert" | "critical";

export interface SafetyFlag {
  readonly type: string;
  readonly severity: SafetyFlagSeverity;
  readonly message: string;
  readonly detectedAt: string;
  readonly requiresHumanReview: boolean;
}

const CRITICALLY_LOW_INTAKE_KCAL = 1000;
const VERY_LOW_INTAKE_KCAL = 1200;
const SEVERE_EA_THRESHOLD = 15;
const RAPID_RESTRICTION_PERCENT = 0.4;

interface IntakeRow {
  snapshot_date: string;
  total_kcal: string;
}

interface WorkoutRow {
  session_date: string;
}

export async function detectSafetyFlags(
  athleteId: string,
): Promise<SafetyFlag[]> {
  const db = buildDb();
  const now = new Date().toISOString();
  const flags: SafetyFlag[] = [];

  const [intakeRows, workoutRows] = await Promise.all([
    db.query<IntakeRow>(
      `SELECT snapshot_date, COALESCE(SUM(energy_kcal), 0) AS total_kcal
         FROM fueling_nutrient_snapshots
        WHERE athlete_id = $1
          AND snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY snapshot_date
        ORDER BY snapshot_date DESC`,
      athleteId,
    ),
    db.query<WorkoutRow>(
      `SELECT DISTINCT session_date
         FROM fueling_workout_sessions
        WHERE athlete_id = $1
          AND session_date >= CURRENT_DATE - INTERVAL '14 days'`,
      athleteId,
    ),
  ]);

  if (intakeRows.length === 0) return flags;

  const intakeByDate = new Map<string, number>(
    intakeRows.map((r) => [r.snapshot_date, Number(r.total_kcal)]),
  );
  const workoutDates = new Set(workoutRows.map((r) => r.session_date));

  // Compute 7-day rolling average (excluding today for baseline)
  const sorted = [...intakeByDate.entries()].sort(([a], [b]) =>
    b.localeCompare(a),
  );
  const todayEntry = sorted[0];
  const priorEntries = sorted.slice(1, 8);
  const todayKcal = todayEntry ? Number(todayEntry[1]) : null;
  const avg7Day =
    priorEntries.length > 0
      ? priorEntries.reduce((sum, [, v]) => sum + Number(v), 0) /
        priorEntries.length
      : null;

  // Flag: critically low intake today
  if (todayKcal !== null && todayKcal < CRITICALLY_LOW_INTAKE_KCAL) {
    flags.push({
      type: "critically_low_intake",
      severity: "critical",
      message: `Today's logged intake (${Math.round(todayKcal)} kcal) is critically low. Intakes below ${CRITICALLY_LOW_INTAKE_KCAL} kcal/day can cause serious health consequences.`,
      detectedAt: now,
      requiresHumanReview: true,
    });
  }

  // Flag: rapid restriction vs baseline
  if (
    todayKcal !== null &&
    avg7Day !== null &&
    avg7Day > 0 &&
    (avg7Day - todayKcal) / avg7Day >= RAPID_RESTRICTION_PERCENT
  ) {
    const dropPercent = Math.round(((avg7Day - todayKcal) / avg7Day) * 100);
    flags.push({
      type: "rapid_calorie_restriction",
      severity: "alert",
      message: `Today's intake is ${dropPercent}% below your 7-day average (${Math.round(avg7Day)} kcal). Sudden restriction increases RED-S risk.`,
      detectedAt: now,
      requiresHumanReview: true,
    });
  }

  // Flag: 3+ consecutive days of very low intake
  let consecutiveLowDays = 0;
  for (const [, kcal] of sorted.slice(0, 7)) {
    if (Number(kcal) < VERY_LOW_INTAKE_KCAL) {
      consecutiveLowDays++;
    } else {
      break;
    }
  }
  if (consecutiveLowDays >= 3) {
    flags.push({
      type: "consecutive_restriction",
      severity: consecutiveLowDays >= 5 ? "critical" : "alert",
      message: `${consecutiveLowDays} consecutive days with intake below ${VERY_LOW_INTAKE_KCAL} kcal. Prolonged restriction is a key RED-S risk factor.`,
      detectedAt: now,
      requiresHumanReview: true,
    });
  }

  // Flag: zero intake logged on workout days (meal skipping pattern)
  const recentDates = sorted.slice(0, 7).map(([date]) => date);
  const skippedWorkoutDays = recentDates.filter(
    (date) => workoutDates.has(date) && (intakeByDate.get(date) ?? 0) === 0,
  );
  if (skippedWorkoutDays.length >= 2) {
    flags.push({
      type: "meal_skipping_on_workout_days",
      severity: "warning",
      message: `No food intake logged on ${skippedWorkoutDays.length} workout days in the past week. Fueling workouts is essential for performance and health.`,
      detectedAt: now,
      requiresHumanReview: false,
    });
  }

  // Flag: severe EA deficit (EA < 15 kcal/kg FFM/day)
  const severeLeaRows = await db.query<{ ea_score: string; ea_date: string }>(
    `SELECT ea_score, ea_date
       FROM fueling_ea_daily_cache
      WHERE athlete_id = $1
        AND ea_date >= CURRENT_DATE - INTERVAL '7 days'
        AND ea_score < $2
      ORDER BY ea_date DESC
      LIMIT 1`,
    athleteId,
    SEVERE_EA_THRESHOLD,
  );
  if (severeLeaRows.length > 0) {
    const severeEA = Number(severeLeaRows[0].ea_score);
    flags.push({
      type: "severe_lea",
      severity: "critical",
      message: `Energy availability of ${severeEA.toFixed(1)} kcal/kg FFM/day detected — well below the LEA threshold of ${LEA_THRESHOLD_KCAL_PER_KG}. This level is associated with serious physiological consequences including bone stress injury and hormonal disruption.`,
      detectedAt: now,
      requiresHumanReview: true,
    });
  }

  return flags;
}
