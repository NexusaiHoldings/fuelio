/**
 * Energy Availability (EA) calculation engine.
 *
 * EA = (Energy Intake - Exercise Energy Expenditure) / Fat Free Mass
 * LEA threshold: < 30 kcal/kg FFM/day  (Mountjoy et al. 2018 consensus)
 * Optimal:       ≥ 45 kcal/kg FFM/day
 *
 * Data sources:
 *   fueling_nutrient_snapshots   — athlete-logged food intake
 *   fueling_workout_sessions     — wearable-derived exercise expenditure
 *   fueling_athlete_profiles     — biometrics including fat_free_mass_kg
 */

import { buildDb } from "@/lib/db";

export const LEA_THRESHOLD_KCAL_PER_KG = 30;
export const OPTIMAL_EA_KCAL_PER_KG = 45;

export interface DailyEARecord {
  readonly date: string;
  readonly energyIntakeKcal: number;
  readonly exerciseEnergyExpenditureKcal: number;
  readonly fatFreeMassKg: number;
  readonly eaScore: number;
  readonly isLEA: boolean;
  readonly isOptimal: boolean;
}

export interface EAResult {
  readonly today: DailyEARecord | null;
  readonly rolling7Day: readonly DailyEARecord[];
  readonly averageEA7Day: number;
  readonly consecutiveLEADays: number;
}

interface NutrientSnapshotRow {
  snapshot_date: string;
  total_kcal: number;
}

interface WorkoutSessionRow {
  session_date: string;
  energy_expenditure_kcal: number;
}

interface AthleteProfileRow {
  fat_free_mass_kg: number;
}

function computeEA(
  intakeKcal: number,
  expenditureKcal: number,
  ffmKg: number,
): number {
  if (ffmKg <= 0) return 0;
  return (intakeKcal - expenditureKcal) / ffmKg;
}

export async function getAthleteFFM(athleteId: string): Promise<number> {
  const db = buildDb();
  const rows = await db.query<AthleteProfileRow>(
    `SELECT fat_free_mass_kg
       FROM fueling_athlete_profiles
      WHERE athlete_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    athleteId,
  );
  if (rows.length === 0) return 70;
  return rows[0].fat_free_mass_kg ?? 70;
}

export async function calculateDailyEA(
  athleteId: string,
  date: string,
): Promise<DailyEARecord | null> {
  const db = buildDb();

  const [intakeRows, expenditureRows, ffmKg] = await Promise.all([
    db.query<NutrientSnapshotRow>(
      `SELECT COALESCE(SUM(energy_kcal), 0) AS total_kcal
         FROM fueling_nutrient_snapshots
        WHERE athlete_id = $1
          AND snapshot_date = $2`,
      athleteId,
      date,
    ),
    db.query<WorkoutSessionRow>(
      `SELECT COALESCE(SUM(energy_expenditure_kcal), 0) AS energy_expenditure_kcal
         FROM fueling_workout_sessions
        WHERE athlete_id = $1
          AND session_date = $2`,
      athleteId,
      date,
    ),
    getAthleteFFM(athleteId),
  ]);

  const intakeKcal = Number(intakeRows[0]?.total_kcal ?? 0);
  const expenditureKcal = Number(
    expenditureRows[0]?.energy_expenditure_kcal ?? 0,
  );

  if (intakeKcal === 0 && expenditureKcal === 0) return null;

  const eaScore = computeEA(intakeKcal, expenditureKcal, ffmKg);

  return {
    date,
    energyIntakeKcal: intakeKcal,
    exerciseEnergyExpenditureKcal: expenditureKcal,
    fatFreeMassKg: ffmKg,
    eaScore,
    isLEA: eaScore < LEA_THRESHOLD_KCAL_PER_KG,
    isOptimal: eaScore >= OPTIMAL_EA_KCAL_PER_KG,
  };
}

export async function getEAHistory(
  athleteId: string,
  days: number = 7,
): Promise<EAResult> {
  const db = buildDb();

  const [intakeRows, expenditureRows, ffmKg] = await Promise.all([
    db.query<{ snapshot_date: string; total_kcal: string }>(
      `SELECT snapshot_date, COALESCE(SUM(energy_kcal), 0) AS total_kcal
         FROM fueling_nutrient_snapshots
        WHERE athlete_id = $1
          AND snapshot_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
        GROUP BY snapshot_date
        ORDER BY snapshot_date DESC`,
      athleteId,
      String(days),
    ),
    db.query<{ session_date: string; energy_expenditure_kcal: string }>(
      `SELECT session_date, COALESCE(SUM(energy_expenditure_kcal), 0) AS energy_expenditure_kcal
         FROM fueling_workout_sessions
        WHERE athlete_id = $1
          AND session_date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
        GROUP BY session_date
        ORDER BY session_date DESC`,
      athleteId,
      String(days),
    ),
    getAthleteFFM(athleteId),
  ]);

  const intakeByDate = new Map<string, number>(
    intakeRows.map((r) => [r.snapshot_date, Number(r.total_kcal)]),
  );
  const expenditureByDate = new Map<string, number>(
    expenditureRows.map((r) => [
      r.session_date,
      Number(r.energy_expenditure_kcal),
    ]),
  );

  const allDates = new Set([
    ...intakeByDate.keys(),
    ...expenditureByDate.keys(),
  ]);

  const records: DailyEARecord[] = Array.from(allDates)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, days)
    .map((date) => {
      const intakeKcal = intakeByDate.get(date) ?? 0;
      const expenditureKcal = expenditureByDate.get(date) ?? 0;
      const eaScore = computeEA(intakeKcal, expenditureKcal, ffmKg);
      return {
        date,
        energyIntakeKcal: intakeKcal,
        exerciseEnergyExpenditureKcal: expenditureKcal,
        fatFreeMassKg: ffmKg,
        eaScore,
        isLEA: eaScore < LEA_THRESHOLD_KCAL_PER_KG,
        isOptimal: eaScore >= OPTIMAL_EA_KCAL_PER_KG,
      };
    });

  const today = records[0] ?? null;
  const averageEA7Day =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.eaScore, 0) / records.length
      : 0;

  let consecutiveLEADays = 0;
  for (const record of records) {
    if (record.isLEA) {
      consecutiveLEADays++;
    } else {
      break;
    }
  }

  return {
    today,
    rolling7Day: records,
    averageEA7Day,
    consecutiveLEADays,
  };
}

export async function upsertDailyEACache(
  athleteId: string,
  record: DailyEARecord,
): Promise<void> {
  const db = buildDb();
  await db.execute(
    `INSERT INTO fueling_ea_daily_cache (
       athlete_id, ea_date, energy_intake_kcal,
       exercise_expenditure_kcal, fat_free_mass_kg,
       ea_score, is_lea, is_optimal, calculated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (athlete_id, ea_date)
     DO UPDATE SET
       energy_intake_kcal      = EXCLUDED.energy_intake_kcal,
       exercise_expenditure_kcal = EXCLUDED.exercise_expenditure_kcal,
       fat_free_mass_kg        = EXCLUDED.fat_free_mass_kg,
       ea_score                = EXCLUDED.ea_score,
       is_lea                  = EXCLUDED.is_lea,
       is_optimal              = EXCLUDED.is_optimal,
       calculated_at           = NOW()`,
    athleteId,
    record.date,
    record.energyIntakeKcal,
    record.exerciseEnergyExpenditureKcal,
    record.fatFreeMassKg,
    record.eaScore,
    record.isLEA,
    record.isOptimal,
  );
}
