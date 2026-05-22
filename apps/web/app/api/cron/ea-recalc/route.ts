/**
 * GET /api/cron/ea-recalc — Vercel cron handler for daily EA recalculation.
 *
 * Scheduled: runs at 03:00 UTC daily (configure in vercel.json).
 * Secured by CRON_SECRET — Vercel injects Authorization: Bearer <secret>.
 *
 * For each active athlete, recalculates yesterday's EA score and writes
 * to fueling_ea_daily_cache so the dashboard read path stays fast.
 */

import { NextResponse } from "next/server";
import { buildDb } from "@/lib/db";
import {
  calculateDailyEA,
  upsertDailyEACache,
} from "@/lib/fueling/energy-availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface AthleteRow {
  athlete_id: string;
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = buildDb();
  const targetDate = yesterday();

  let athletes: AthleteRow[];
  try {
    athletes = await db.query<AthleteRow>(
      `SELECT DISTINCT athlete_id
         FROM fueling_athlete_profiles
        WHERE is_active = true`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ea-recalc] failed to load athletes", { error: message });
    return NextResponse.json(
      { error: "Failed to load athletes", detail: message },
      { status: 500 },
    );
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { athleteId: string; error: string }[] = [];

  for (const { athlete_id } of athletes) {
    try {
      const record = await calculateDailyEA(athlete_id, targetDate);
      if (record === null) {
        skipped++;
        continue;
      }
      await upsertDailyEACache(athlete_id, record);
      processed++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ athleteId: athlete_id, error: message });
      console.error("[ea-recalc] failed for athlete", {
        athleteId: athlete_id,
        error: message,
      });
    }
  }

  console.log("[ea-recalc] completed", {
    date: targetDate,
    total: athletes.length,
    processed,
    skipped,
    failed,
  });

  return NextResponse.json({
    ok: true,
    date: targetDate,
    total: athletes.length,
    processed,
    skipped,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
