/**
 * POST /api/sync/sheets
 *
 * Triggers a full Google Sheets → Neon sync.
 * Protected: requires an authenticated Clerk session OR the
 * CRON_SECRET header (for scheduled invocations).
 *
 * Response:
 *   200  { ok: true, rowsProcessed, durationMs, spreadsheets }
 *   401  Unauthorized
 *   500  { ok: false, error: string }
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { runSheetsSync } from "@/lib/sheets/sync";

export const runtime = "nodejs"; // googleapis requires Node.js runtime

export async function POST(req: NextRequest) {
  // Allow either a signed-in user or a trusted cron caller
  const cronSecret = process.env.CRON_SECRET;
  const callerSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && callerSecret === cronSecret;

  if (!isCron) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runSheetsSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync/sheets] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
