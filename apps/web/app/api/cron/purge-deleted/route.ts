import { NextRequest, NextResponse } from "next/server";
import { hardPurgeDeletedData } from "@/lib/fueling/data-erasure";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawDays = request.nextUrl.searchParams.get("olderThanDays");
  const olderThanDays =
    rawDays !== null && /^\d+$/.test(rawDays) ? parseInt(rawDays, 10) : 30;

  try {
    const result = await hardPurgeDeletedData(olderThanDays);
    process.stdout.write(
      JSON.stringify({
        event: "hard_purge_cron",
        olderThanDays,
        tablesProcessed: result.tablesProcessed,
        rowsPurged: result.rowsPurged,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }) + "\n"
    );
    const status = result.errors.length > 0 ? 207 : 200;
    return NextResponse.json({ success: true, ...result }, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      JSON.stringify({
        event: "hard_purge_cron_error",
        error: message,
        timestamp: new Date().toISOString(),
      }) + "\n"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
