/**
 * Apple Health REST bridge client for wearable training-load sync (F1-003).
 *
 * Implements OAuth 2.0 PKCE flow to connect with Apple HealthKit via a REST
 * bridge, and fetches completed workout data including sport type, duration,
 * and energy expenditure.
 */

import crypto from "crypto";

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

export interface WearableWorkout {
  readonly externalId: string;
  readonly userId: string;
  readonly provider: "apple_health" | "garmin";
  readonly sportType: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly durationSeconds: number;
  readonly energyKcal: number | null;
  readonly isCompleted: boolean;
}

export interface AppleHealthConnection {
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenExpiry: Date;
  readonly lastSyncCursor: string | null;
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function createAppleClientSecret(): string {
  const kid = process.env.APPLE_KEY_ID ?? "";
  const teamId = process.env.APPLE_TEAM_ID ?? "";
  const clientId = process.env.APPLE_CLIENT_ID ?? "";
  const rawKey = (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: now, exp: now + 86400, aud: "https://appleid.apple.com", sub: clientId }),
  ).toString("base64url");

  const unsigned = header + "." + payload;
  const privateKey = crypto.createPrivateKey(rawKey);
  const sig = crypto.sign("SHA256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return unsigned + "." + Buffer.from(sig).toString("base64url");
}

export function buildAppleAuthorizationUrl(state: string, codeChallenge: string): string {
  const redirectUri =
    process.env.APPLE_HEALTH_REDIRECT_URI ??
    (process.env.NEXTAUTH_URL ?? "") + "/integrations/apple-health/callback";

  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "health:workouts",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_mode: "query",
  });
  return "https://appleid.apple.com/auth/authorize?" + params.toString();
}

export async function exchangeAppleCodeForToken(
  code: string,
  codeVerifier: string,
  userId: string,
): Promise<AppleHealthConnection> {
  const clientSecret = createAppleClientSecret();
  const redirectUri =
    process.env.APPLE_HEALTH_REDIRECT_URI ??
    (process.env.NEXTAUTH_URL ?? "") + "/integrations/apple-health/callback";

  const body = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID ?? "",
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Apple token exchange failed: " + response.status + " " + text);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
  const pool = getPool();

  await pool.query(
    "INSERT INTO fueling_wearable_connections " +
      "(user_id, provider, access_token, refresh_token, token_expiry, last_sync_cursor, created_at, updated_at) " +
      "VALUES ($1, $2, $3, $4, $5, NULL, NOW(), NOW()) " +
      "ON CONFLICT (user_id, provider) DO UPDATE SET " +
      "access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, " +
      "token_expiry = EXCLUDED.token_expiry, updated_at = NOW()",
    [userId, "apple_health", data.access_token, data.refresh_token, tokenExpiry],
  );

  return {
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry,
    lastSyncCursor: null,
  };
}

export async function refreshAppleToken(conn: AppleHealthConnection): Promise<AppleHealthConnection> {
  const clientSecret = createAppleClientSecret();
  const body = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID ?? "",
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
  });

  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Apple token refresh failed: " + response.status);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

  const pool = getPool();
  await pool.query(
    "UPDATE fueling_wearable_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() " +
      "WHERE user_id = $3 AND provider = $4",
    [data.access_token, tokenExpiry, conn.userId, "apple_health"],
  );

  return { ...conn, accessToken: data.access_token, tokenExpiry };
}

export async function fetchAppleWorkouts(
  conn: AppleHealthConnection,
  cursor?: string,
): Promise<{ workouts: WearableWorkout[]; nextCursor: string | null }> {
  let activeConn = conn;
  if (activeConn.tokenExpiry <= new Date()) {
    activeConn = await refreshAppleToken(activeConn);
  }

  const bridgeBase = process.env.APPLE_HEALTH_BRIDGE_URL ?? "https://healthkit-bridge.apple.com/v1";
  const queryParams = new URLSearchParams({ limit: "100" });
  if (cursor) queryParams.set("after", cursor);

  const response = await fetch(bridgeBase + "/workouts?" + queryParams.toString(), {
    headers: { Authorization: "Bearer " + activeConn.accessToken },
  });

  if (!response.ok) {
    throw new Error("Apple Health API error: " + response.status);
  }

  const data = (await response.json()) as {
    workouts: Array<{
      id: string;
      workoutActivityType: string;
      startDate: string;
      endDate: string;
      duration: number;
      totalEnergyBurned?: number;
    }>;
    nextCursor: string | null;
  };

  const workouts: WearableWorkout[] = data.workouts.map((w) => ({
    externalId: w.id,
    userId: activeConn.userId,
    provider: "apple_health",
    sportType: w.workoutActivityType,
    startTime: new Date(w.startDate),
    endTime: new Date(w.endDate),
    durationSeconds: Math.round(w.duration),
    energyKcal: w.totalEnergyBurned ?? null,
    isCompleted: true,
  }));

  return { workouts, nextCursor: data.nextCursor };
}

export async function getAppleHealthConnection(userId: string): Promise<AppleHealthConnection | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT user_id, access_token, refresh_token, token_expiry, last_sync_cursor " +
      "FROM fueling_wearable_connections WHERE user_id = $1 AND provider = $2 LIMIT 1",
    [userId, "apple_health"],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as {
    user_id: string;
    access_token: string;
    refresh_token: string;
    token_expiry: Date;
    last_sync_cursor: string | null;
  };

  return {
    userId: row.user_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: new Date(row.token_expiry),
    lastSyncCursor: row.last_sync_cursor,
  };
}

export async function disconnectAppleHealth(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    "DELETE FROM fueling_wearable_connections WHERE user_id = $1 AND provider = $2",
    [userId, "apple_health"],
  );
}
