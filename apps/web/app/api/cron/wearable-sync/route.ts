/**
 * Vercel Cron handler — wearable training-load sync (F1-003).
 *
 * Triggered on a schedule (e.g. every 15 minutes) to pull the latest
 * completed workout data from Apple Health and Garmin Connect for all
 * connected users. Uses cursor-based idempotent sync to avoid duplicates.
 *
 * Vercel Cron: configure in vercel.json with path /api/cron/wearable-sync
 * and the desired schedule. Protects the endpoint with CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { syncAllConnectedUsers, ensureWearableSchema } from "@/lib/fueling/wearable-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (authHeader !== "Bearer " + cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();

  try {
    await ensureWearableSchema();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ event: "wearable_sync_schema_error", error: message }),
    );
    return NextResponse.json(
      { ok: false, error: "Schema initialization failed: " + message },
      { status: 500 },
    );
  }

  let results;
  try {
    results = await syncAllConnectedUsers();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ event: "wearable_sync_fatal", error: message }),
    );
    return NextResponse.json(
      { ok: false, error: "Sync failed: " + message },
      { status: 500 },
    );
  }

  const durationMs = Date.now() - startedAt;
  const totalSynced = results.results.reduce((acc, r) => acc + r.synced, 0);
  const totalErrors = results.results.reduce((acc, r) => acc + r.errors.length, 0);

  console.info(
    JSON.stringify({
      event: "wearable_sync_cron_complete",
      totalConnections: results.results.length,
      totalSynced,
      totalErrors,
      topErrors: results.errors,
      durationMs,
    }),
  );

  return NextResponse.json({
    ok: true,
    stats: {
      connections: results.results.length,
      workoutsSynced: totalSynced,
      errors: totalErrors,
      topLevelErrors: results.errors,
      durationMs,
    },
    results: results.results.map((r) => ({
      userId: r.userId,
      provider: r.provider,
      synced: r.synced,
      errors: r.errors,
      lastCursor: r.lastCursor,
    })),
  });
}
