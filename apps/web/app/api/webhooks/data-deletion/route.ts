import { NextRequest, NextResponse } from "next/server";
import { softDeleteUserHealthData } from "@/lib/fueling/data-erasure";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.DATA_DELETION_WEBHOOK_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("userId" in body) ||
    typeof (body as { userId: unknown }).userId !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid userId" },
      { status: 400 }
    );
  }

  const { userId } = body as { userId: string };

  try {
    const result = await softDeleteUserHealthData(userId);
    process.stdout.write(
      JSON.stringify({
        event: "data_deletion_webhook",
        userId,
        tablesUpdated: result.tablesUpdated,
        rowsMarked: result.rowsMarked,
        timestamp: new Date().toISOString(),
      }) + "\n"
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      JSON.stringify({
        event: "data_deletion_webhook_error",
        userId,
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
