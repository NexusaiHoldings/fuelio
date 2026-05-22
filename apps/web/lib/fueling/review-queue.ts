/**
 * RD Human Review Queue — server-side data access for athlete safety flags.
 *
 * Safety flags are created by the safety-flags worker when disordered eating
 * patterns, anomalous caloric intake, or medical condition disclosures are
 * detected. Flagged athletes are locked from AI recommendation generation
 * until an RD reviews the flag. Audit trail written to admin_audit_log
 * (admin-console lego table).
 *
 * Feature: F1-008 · Safety escalation / human-in-loop requirement.
 */

// pg pool — same eval("require") pattern as apps/web/lib/db.ts to prevent
// webpack from bundling Node-native modules (net/tls) for the client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = eval("require")("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (
        sql: string,
        params?: unknown[]
      ) => Promise<{ rows: Record<string, unknown>[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type FlagType =
  | "disordered_eating"
  | "anomalous_caloric_intake"
  | "medical_condition_disclosure"
  | "overtraining_risk";

export type FlagSeverity = "low" | "medium" | "high" | "critical";

export type FlagStatus =
  | "pending_review"
  | "cleared"
  | "escalated"
  | "info_requested";

export type ReviewDecision = "cleared" | "escalated" | "info_requested";

export interface SafetyFlag {
  id: string;
  athlete_id: string;
  athlete_name: string;
  athlete_email: string;
  flag_type: FlagType;
  severity: FlagSeverity;
  details: Record<string, unknown>;
  status: FlagStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
}

export interface FlagListResult {
  flags: SafetyFlag[];
  total: number;
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * List all pending safety flags ordered by severity (critical first) then
 * chronologically ascending (oldest unreviewed flag first).
 */
export async function listPendingFlags(
  limit: number = 50,
  offset: number = 0
): Promise<FlagListResult> {
  const pool = getPool();

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT
         sf.id,
         sf.athlete_id,
         sf.flag_type,
         sf.severity,
         sf.details,
         sf.status,
         sf.created_at,
         sf.reviewed_at,
         sf.reviewed_by,
         sf.review_notes,
         COALESCE(ap.full_name, 'Unknown Athlete') AS athlete_name,
         COALESCE(ap.email,     '')                AS athlete_email
       FROM athlete_safety_flags sf
       LEFT JOIN athlete_profiles ap ON ap.id = sf.athlete_id
       WHERE sf.status = 'pending_review'
       ORDER BY
         CASE sf.severity
           WHEN 'critical' THEN 0
           WHEN 'high'     THEN 1
           WHEN 'medium'   THEN 2
           ELSE                 3
         END,
         sf.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) AS total
       FROM athlete_safety_flags
       WHERE status = 'pending_review'`,
      []
    ),
  ]);

  const flags: SafetyFlag[] = dataRes.rows.map((row) => ({
    id: String(row["id"]),
    athlete_id: String(row["athlete_id"]),
    athlete_name: String(row["athlete_name"]),
    athlete_email: String(row["athlete_email"]),
    flag_type: row["flag_type"] as FlagType,
    severity: row["severity"] as FlagSeverity,
    details: (row["details"] as Record<string, unknown>) ?? {},
    status: row["status"] as FlagStatus,
    created_at: String(row["created_at"]),
    reviewed_at: row["reviewed_at"] != null ? String(row["reviewed_at"]) : null,
    reviewed_by: row["reviewed_by"] != null ? String(row["reviewed_by"]) : null,
    review_notes:
      row["review_notes"] != null ? String(row["review_notes"]) : null,
  }));

  const totalRow = countRes.rows[0] as { total: string } | undefined;
  const total = parseInt(totalRow?.total ?? "0", 10);

  return { flags, total };
}

/**
 * Fetch a single safety flag including joined athlete profile data.
 * Returns null if the flag does not exist.
 */
export async function getFlagDetails(
  flagId: string
): Promise<SafetyFlag | null> {
  const pool = getPool();

  const res = await pool.query(
    `SELECT
       sf.id,
       sf.athlete_id,
       sf.flag_type,
       sf.severity,
       sf.details,
       sf.status,
       sf.created_at,
       sf.reviewed_at,
       sf.reviewed_by,
       sf.review_notes,
       COALESCE(ap.full_name, 'Unknown Athlete') AS athlete_name,
       COALESCE(ap.email,     '')                AS athlete_email
     FROM athlete_safety_flags sf
     LEFT JOIN athlete_profiles ap ON ap.id = sf.athlete_id
     WHERE sf.id = $1::uuid`,
    [flagId]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    id: String(row["id"]),
    athlete_id: String(row["athlete_id"]),
    athlete_name: String(row["athlete_name"]),
    athlete_email: String(row["athlete_email"]),
    flag_type: row["flag_type"] as FlagType,
    severity: row["severity"] as FlagSeverity,
    details: (row["details"] as Record<string, unknown>) ?? {},
    status: row["status"] as FlagStatus,
    created_at: String(row["created_at"]),
    reviewed_at: row["reviewed_at"] != null ? String(row["reviewed_at"]) : null,
    reviewed_by: row["reviewed_by"] != null ? String(row["reviewed_by"]) : null,
    review_notes:
      row["review_notes"] != null ? String(row["review_notes"]) : null,
  };
}

/**
 * Record the RD's review decision: update the flag status and write an
 * immutable audit entry to admin_audit_log.
 */
export async function submitReviewDecision(
  flagId: string,
  decision: ReviewDecision,
  rdUserId: string,
  notes: string
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE athlete_safety_flags
     SET
       status       = $1,
       reviewed_at  = NOW(),
       reviewed_by  = $2::uuid,
       review_notes = $3
     WHERE id = $4::uuid`,
    [decision, rdUserId, notes.trim(), flagId]
  );

  // Immutable audit trail — admin-console lego owns this table.
  await pool.query(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, action, target_type, target_id, payload, performed_at)
     VALUES
       (gen_random_uuid(), $1::uuid, $2, 'athlete_safety_flag', $3::uuid, $4::jsonb, NOW())`,
    [
      rdUserId,
      `review_queue.${decision}`,
      flagId,
      JSON.stringify({ decision, notes: notes.trim() }),
    ]
  );
}
