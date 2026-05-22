import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface SoftDeleteResult {
  tablesUpdated: number;
  rowsMarked: number;
}

export interface PurgeResult {
  tablesProcessed: number;
  rowsPurged: number;
  errors: string[];
}

const HEALTH_DATA_TABLES = [
  "fueling_meal_logs",
  "fueling_nutrient_snapshots",
  "fueling_workout_sessions",
  "fueling_ea_scores",
  "fueling_recommendations",
  "fueling_wearable_tokens",
] as const;

export async function softDeleteUserHealthData(
  userId: string
): Promise<SoftDeleteResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let rowsMarked = 0;
    let tablesUpdated = 0;

    for (const table of HEALTH_DATA_TABLES) {
      const result = await client.query(
        `UPDATE ${table} SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId]
      );
      if (result.rowCount && result.rowCount > 0) {
        rowsMarked += result.rowCount;
        tablesUpdated++;
      }
    }

    await client.query("COMMIT");
    return { tablesUpdated, rowsMarked };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function hardPurgeDeletedData(
  olderThanDays = 30
): Promise<PurgeResult> {
  const client = await pool.connect();
  const errors: string[] = [];
  let rowsPurged = 0;
  let tablesProcessed = 0;

  try {
    for (const table of HEALTH_DATA_TABLES) {
      try {
        const result = await client.query(
          `DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - ($1 || ' days')::INTERVAL`,
          [String(olderThanDays)]
        );
        rowsPurged += result.rowCount ?? 0;
        tablesProcessed++;
      } catch (tableErr) {
        const message =
          tableErr instanceof Error ? tableErr.message : String(tableErr);
        errors.push(`${table}: ${message}`);
      }
    }
  } finally {
    client.release();
  }

  return { tablesProcessed, rowsPurged, errors };
}
