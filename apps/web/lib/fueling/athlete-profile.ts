/**
 * Athlete profile data access layer.
 * Stores sport type, weekly training hours, body weight, and fitness goals
 * as the foundation for Energy Availability calculations.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  const { Pool: PgPool } = eval("require")("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

export type SportType = "runner" | "cyclist" | "triathlete";

export type FitnessGoal =
  | "performance_improvement"
  | "endurance_building"
  | "weight_management"
  | "injury_prevention"
  | "recovery_optimization";

export interface AthleteProfile {
  id: string;
  user_id: string;
  sport_type: SportType;
  weekly_training_hours: number;
  body_weight_kg: number;
  fitness_goals: FitnessGoal[];
  created_at: string;
  updated_at: string;
}

export interface UpsertAthleteProfileInput {
  user_id: string;
  sport_type: SportType;
  weekly_training_hours: number;
  body_weight_kg: number;
  fitness_goals: FitnessGoal[];
}

function rowToProfile(row: Record<string, unknown>): AthleteProfile {
  const goals = row.fitness_goals;
  const parsed: FitnessGoal[] = Array.isArray(goals)
    ? (goals as FitnessGoal[])
    : JSON.parse(String(goals));
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    sport_type: row.sport_type as SportType,
    weekly_training_hours: Number(row.weekly_training_hours),
    body_weight_kg: Number(row.body_weight_kg),
    fitness_goals: parsed,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getAthleteProfile(
  userId: string,
): Promise<AthleteProfile | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, sport_type, weekly_training_hours, body_weight_kg,
            fitness_goals, created_at, updated_at
     FROM athlete_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  if (result.rows.length === 0) return null;
  return rowToProfile(result.rows[0] as Record<string, unknown>);
}

export async function upsertAthleteProfile(
  input: UpsertAthleteProfileInput,
): Promise<AthleteProfile> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO athlete_profiles
       (id, user_id, sport_type, weekly_training_hours, body_weight_kg, fitness_goals, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       sport_type             = EXCLUDED.sport_type,
       weekly_training_hours  = EXCLUDED.weekly_training_hours,
       body_weight_kg         = EXCLUDED.body_weight_kg,
       fitness_goals          = EXCLUDED.fitness_goals,
       updated_at             = NOW()
     RETURNING id, user_id, sport_type, weekly_training_hours, body_weight_kg,
               fitness_goals, created_at, updated_at`,
    [
      input.user_id,
      input.sport_type,
      input.weekly_training_hours,
      input.body_weight_kg,
      JSON.stringify(input.fitness_goals),
    ],
  );
  return rowToProfile(result.rows[0] as Record<string, unknown>);
}

export function validateAthleteProfileInput(
  sportType: string,
  weeklyTrainingHours: number,
  bodyWeightKg: number,
  fitnessGoals: string[],
): string | null {
  const validSports: SportType[] = ["runner", "cyclist", "triathlete"];
  if (!validSports.includes(sportType as SportType)) {
    return `Sport must be one of: ${validSports.join(", ")}`;
  }
  if (!Number.isFinite(weeklyTrainingHours) || weeklyTrainingHours < 0 || weeklyTrainingHours > 40) {
    return "Weekly training hours must be between 0 and 40";
  }
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 30 || bodyWeightKg > 300) {
    return "Body weight must be between 30 and 300 kg";
  }
  if (fitnessGoals.length === 0) {
    return "Select at least one fitness goal";
  }
  return null;
}

export function extractUserIdFromSessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const uid = payload.sub ?? payload.userId ?? payload.id;
    return typeof uid === "string" && uid.length > 0 ? uid : null;
  } catch {
    return null;
  }
}
