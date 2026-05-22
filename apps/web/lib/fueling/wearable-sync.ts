/**
 * Wearable training-load sync orchestrator (F1-003).
 *
 * Implements idempotent cursor-based sync with retry logic to handle API
 * unreliability (key_technical_risk from feasibility_analysis). Syncs
 * completed workout data from Apple Health and Garmin Connect and stores
 * it for training-load-aware meal planning.
 */

import type { WearableWorkout } from "./apple-health-client";
import {
  getAppleHealthConnection,
  fetchAppleWorkouts,
} from "./apple-health-client";
import { getGarminConnection, fetchGarminActivities } from "./garmin-client";

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
  _pool = new PgPool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });
  return _pool;
}

export interface SyncResult {
  readonly userId: string;
  readonly provider: "apple_health" | "garmin";
  readonly synced: number;
  readonly errors: string[];
  readonly lastCursor: string | null;
}

export async function ensureWearableSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(
    "CREATE TABLE IF NOT EXISTS fueling_wearable_connections (" +
      "  user_id UUID NOT NULL," +
      "  provider TEXT NOT NULL," +
      "  access_token TEXT NOT NULL," +
      "  refresh_token TEXT," +
      "  token_expiry TIMESTAMPTZ," +
      "  last_sync_cursor TEXT," +
      "  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
      "  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
      "  PRIMARY KEY (user_id, provider)" +
      ")",
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS fueling_wearable_workouts (" +
      "  id UUID PRIMARY KEY DEFAULT gen_random_uuid()," +
      "  user_id UUID NOT NULL," +
      "  provider TEXT NOT NULL," +
      "  external_id TEXT NOT NULL," +
      "  sport_type TEXT NOT NULL," +
      "  start_time TIMESTAMPTZ NOT NULL," +
      "  end_time TIMESTAMPTZ NOT NULL," +
      "  duration_seconds INTEGER NOT NULL," +
      "  energy_kcal NUMERIC," +
      "  is_completed BOOLEAN NOT NULL DEFAULT TRUE," +
      "  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
      "  UNIQUE (user_id, provider, external_id)" +
      ")",
  );
}

async function saveWorkouts(workouts: WearableWorkout[]): Promise<void> {
  const pool = getPool();
  for (const workout of workouts) {
    await pool.query(
      "INSERT INTO fueling_wearable_workouts " +
        "(user_id, provider, external_id, sport_type, start_time, end_time, duration_seconds, energy_kcal, is_completed, synced_at) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) " +
        "ON CONFLICT (user_id, provider, external_id) DO UPDATE SET " +
        "sport_type = EXCLUDED.sport_type, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, " +
        "duration_seconds = EXCLUDED.duration_seconds, energy_kcal = EXCLUDED.energy_kcal, " +
        "is_completed = EXCLUDED.is_completed, synced_at = NOW()",
      [
        workout.userId,
        workout.provider,
        workout.externalId,
        workout.sportType,
        workout.startTime,
        workout.endTime,
        workout.durationSeconds,
        workout.energyKcal,
        workout.isCompleted,
      ],
    );
  }
}

async function updateSyncCursor(
  userId: string,
  provider: string,
  cursor: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    "UPDATE fueling_wearable_connections SET last_sync_cursor = $1, updated_at = NOW() " +
      "WHERE user_id = $2 AND provider = $3",
    [cursor, userId, provider],
  );
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt >= MAX_RETRIES - 1) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    return withRetry(fn, attempt + 1);
  }
}

export async function syncAppleHealthForUser(userId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;
  let lastCursor: string | null = null;

  const connection = await getAppleHealthConnection(userId);
  if (!connection) {
    return { userId, provider: "apple_health", synced: 0, errors: ["No Apple Health connection found"], lastCursor: null };
  }

  let cursor: string | undefined = connection.lastSyncCursor ?? undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const captured = cursor;
      const { workouts, nextCursor } = await withRetry(() =>
        fetchAppleWorkouts(connection, captured),
      );

      if (workouts.length > 0) {
        await saveWorkouts(workouts);
        synced += workouts.length;
      }

      if (nextCursor) {
        cursor = nextCursor;
        lastCursor = nextCursor;
        await updateSyncCursor(userId, "apple_health", nextCursor);
      } else {
        hasMore = false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      console.error(
        JSON.stringify({ event: "apple_health_sync_error", userId, error: message }),
      );
      hasMore = false;
    }
  }

  return { userId, provider: "apple_health", synced, errors, lastCursor };
}

export async function syncGarminForUser(userId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;
  let lastCursor: string | null = null;

  const connection = await getGarminConnection(userId);
  if (!connection) {
    return { userId, provider: "garmin", synced: 0, errors: ["No Garmin connection found"], lastCursor: null };
  }

  let cursor: string | undefined = connection.lastSyncCursor ?? undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const captured = cursor;
      const { activities, nextCursor } = await withRetry(() =>
        fetchGarminActivities(connection, captured),
      );

      if (activities.length > 0) {
        await saveWorkouts(activities);
        synced += activities.length;
      }

      if (nextCursor) {
        cursor = nextCursor;
        lastCursor = nextCursor;
        await updateSyncCursor(userId, "garmin", nextCursor);
      } else {
        hasMore = false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      console.error(JSON.stringify({ event: "garmin_sync_error", userId, error: message }));
      hasMore = false;
    }
  }

  return { userId, provider: "garmin", synced, errors, lastCursor };
}

export async function syncAllConnectedUsers(): Promise<{
  results: SyncResult[];
  errors: string[];
}> {
  const pool = getPool();
  const allResults: SyncResult[] = [];
  const topErrors: string[] = [];

  let rows: Array<{ user_id: string; provider: string }> = [];
  try {
    const result = await pool.query(
      "SELECT user_id, provider FROM fueling_wearable_connections ORDER BY user_id",
    );
    rows = result.rows as Array<{ user_id: string; provider: string }>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    topErrors.push("Failed to query connections: " + message);
    console.error(JSON.stringify({ event: "wearable_sync_query_error", error: message }));
    return { results: allResults, errors: topErrors };
  }

  for (const row of rows) {
    if (row.provider === "apple_health") {
      const res = await syncAppleHealthForUser(row.user_id);
      allResults.push(res);
    } else if (row.provider === "garmin") {
      const res = await syncGarminForUser(row.user_id);
      allResults.push(res);
    }
  }

  console.info(
    JSON.stringify({
      event: "wearable_sync_complete",
      total: allResults.length,
      synced: allResults.reduce((acc, r) => acc + r.synced, 0),
      errors: allResults.reduce((acc, r) => acc + r.errors.length, 0),
    }),
  );

  return { results: allResults, errors: topErrors };
}
