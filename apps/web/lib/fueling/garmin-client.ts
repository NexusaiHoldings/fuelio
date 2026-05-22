/**
 * Garmin Connect API client for wearable training-load sync (F1-003).
 *
 * Implements OAuth 1.0a to connect with Garmin Connect IQ and fetches
 * activity data including sport type, duration, and energy expenditure.
 */

import crypto from "crypto";
import type { WearableWorkout } from "./apple-health-client";

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

export interface GarminConnection {
  readonly userId: string;
  readonly accessToken: string;
  readonly accessTokenSecret: string;
  readonly lastSyncCursor: string | null;
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function buildOAuthAuthorizationHeader(
  method: string,
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string,
  queryParams: Record<string, string>,
  oauthToken?: string,
  oauthTokenSecret?: string,
  extraOAuthParams?: Record<string, string>,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extraOAuthParams,
  };
  if (oauthToken) oauthParams.oauth_token = oauthToken;

  const allParams: Record<string, string> = { ...queryParams, ...oauthParams };

  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(allParams[k]))
    .join("&");

  const baseString =
    method.toUpperCase() +
    "&" +
    encodeURIComponent(baseUrl) +
    "&" +
    encodeURIComponent(paramString);

  const signingKey =
    encodeURIComponent(consumerSecret) + "&" + encodeURIComponent(oauthTokenSecret ?? "");

  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParts = { ...oauthParams, oauth_signature: signature };
  const headerStr = Object.entries(headerParts)
    .map(([k, v]) => k + '="' + encodeURIComponent(v) + '"')
    .join(", ");

  return "OAuth " + headerStr;
}

export async function getGarminRequestToken(): Promise<{
  requestToken: string;
  requestTokenSecret: string;
}> {
  const url = "https://connectapi.garmin.com/oauth-service/oauth/request_token";
  const consumerKey = process.env.GARMIN_CONSUMER_KEY ?? "";
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET ?? "";

  const callbackUrl =
    process.env.GARMIN_REDIRECT_URI ??
    (process.env.NEXTAUTH_URL ?? "") + "/integrations/garmin/callback";

  const authHeader = buildOAuthAuthorizationHeader("POST", url, consumerKey, consumerSecret, {}, undefined, undefined, {
    oauth_callback: callbackUrl,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Garmin request token failed: " + response.status + " " + text);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    requestToken: params.get("oauth_token") ?? "",
    requestTokenSecret: params.get("oauth_token_secret") ?? "",
  };
}

export function buildGarminAuthorizationUrl(requestToken: string): string {
  return (
    "https://connect.garmin.com/oauthConfirm?oauth_token=" + encodeURIComponent(requestToken)
  );
}

export async function exchangeGarminToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string,
  userId: string,
): Promise<GarminConnection> {
  const url = "https://connectapi.garmin.com/oauth-service/oauth/access_token";
  const consumerKey = process.env.GARMIN_CONSUMER_KEY ?? "";
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET ?? "";

  const authHeader = buildOAuthAuthorizationHeader(
    "POST",
    url,
    consumerKey,
    consumerSecret,
    {},
    requestToken,
    requestTokenSecret,
    { oauth_verifier: verifier },
  );

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Garmin access token exchange failed: " + response.status + " " + text);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);
  const accessToken = params.get("oauth_token") ?? "";
  const accessTokenSecret = params.get("oauth_token_secret") ?? "";

  const pool = getPool();
  await pool.query(
    "INSERT INTO fueling_wearable_connections " +
      "(user_id, provider, access_token, refresh_token, token_expiry, last_sync_cursor, created_at, updated_at) " +
      "VALUES ($1, $2, $3, $4, NULL, NULL, NOW(), NOW()) " +
      "ON CONFLICT (user_id, provider) DO UPDATE SET " +
      "access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, updated_at = NOW()",
    [userId, "garmin", accessToken, accessTokenSecret],
  );

  return { userId, accessToken, accessTokenSecret, lastSyncCursor: null };
}

export async function fetchGarminActivities(
  conn: GarminConnection,
  cursor?: string,
): Promise<{ activities: WearableWorkout[]; nextCursor: string | null }> {
  const baseUrl = "https://apis.garmin.com/wellness-api/rest/activities";
  const consumerKey = process.env.GARMIN_CONSUMER_KEY ?? "";
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET ?? "";

  const queryParams: Record<string, string> = { limit: "100" };
  if (cursor) queryParams.uploadStartTimestampInSeconds = cursor;

  const authHeader = buildOAuthAuthorizationHeader(
    "GET",
    baseUrl,
    consumerKey,
    consumerSecret,
    queryParams,
    conn.accessToken,
    conn.accessTokenSecret,
  );

  const fullUrl = baseUrl + "?" + new URLSearchParams(queryParams).toString();

  const response = await fetch(fullUrl, {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    throw new Error("Garmin activities API error: " + response.status);
  }

  const data = (await response.json()) as Array<{
    activityId: number;
    activityType: string;
    startTimeInSeconds: number;
    durationInSeconds: number;
    activeKilocalories?: number;
    uploadStartTimeInSeconds?: number;
  }>;

  const activities: WearableWorkout[] = data.map((a) => ({
    externalId: String(a.activityId),
    userId: conn.userId,
    provider: "garmin",
    sportType: a.activityType,
    startTime: new Date(a.startTimeInSeconds * 1000),
    endTime: new Date((a.startTimeInSeconds + a.durationInSeconds) * 1000),
    durationSeconds: a.durationInSeconds,
    energyKcal: a.activeKilocalories ?? null,
    isCompleted: true,
  }));

  const lastItem = data[data.length - 1];
  const nextCursor =
    data.length === 100 && lastItem
      ? String(
          lastItem.uploadStartTimeInSeconds ??
            lastItem.startTimeInSeconds + lastItem.durationInSeconds,
        )
      : null;

  return { activities, nextCursor };
}

export async function getGarminConnection(userId: string): Promise<GarminConnection | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT user_id, access_token, refresh_token, last_sync_cursor " +
      "FROM fueling_wearable_connections WHERE user_id = $1 AND provider = $2 LIMIT 1",
    [userId, "garmin"],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as {
    user_id: string;
    access_token: string;
    refresh_token: string;
    last_sync_cursor: string | null;
  };

  return {
    userId: row.user_id,
    accessToken: row.access_token,
    accessTokenSecret: row.refresh_token,
    lastSyncCursor: row.last_sync_cursor,
  };
}

export async function disconnectGarmin(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    "DELETE FROM fueling_wearable_connections WHERE user_id = $1 AND provider = $2",
    [userId, "garmin"],
  );
}
