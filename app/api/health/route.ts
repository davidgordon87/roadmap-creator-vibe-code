import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

/**
 * GET /api/health
 *
 * Returns {"db":"ok"} if Neon is reachable and the sync_log table exists.
 * Returns {"db":"error", "detail": "..."} on failure.
 *
 * M2 acceptance check: curl http://localhost:3000/api/health
 */
export async function GET() {
  try {
    const sql = getDb();
    await sql`SELECT id FROM sync_log LIMIT 1`;
    return NextResponse.json({ db: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ db: "error", detail: message }, { status: 500 });
  }
}
