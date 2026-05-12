/**
 * POST /api/slack/remind
 *
 * Sends a Slack DM to every owner of the given initiative asking them
 * to review and update their roadmap item.
 *
 * Requires SLACK_BOT_TOKEN in environment variables.
 * Body: { initiativeId: string }
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getDb } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "SLACK_BOT_TOKEN is not configured" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { initiativeId } = body as { initiativeId?: string };
  if (!initiativeId) {
    return NextResponse.json({ error: "initiativeId is required" }, { status: 400 });
  }

  const sql = getDb();

  const initiatives = await sql`
    SELECT id, title FROM public.initiatives WHERE id = ${initiativeId} LIMIT 1
  `;
  const initiative = initiatives[0] as { id: string; title: string } | undefined;
  if (!initiative) {
    return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
  }

  const owners = await sql`
    SELECT id, user_email
    FROM public.initiative_owners
    WHERE initiative_id = ${initiativeId}
  ` as { id: string; user_email: string }[];

  if (!owners.length) {
    return NextResponse.json({ error: "No owners assigned to this initiative" }, { status: 400 });
  }

  const slack = new WebClient(token);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const results: { email: string; sent: boolean; error?: string }[] = [];

  for (const owner of owners) {
    try {
      const lookup = await slack.users.lookupByEmail({ email: owner.user_email });
      const slackUserId = lookup.user?.id;

      if (!slackUserId) {
        results.push({ email: owner.user_email, sent: false, error: "User not in Slack workspace" });
        continue;
      }

      await slack.chat.postMessage({
        channel: slackUserId,
        text: `👋 You've been asked to review your roadmap item:\n\n*${initiative.title}*\n\nPlease check in and update the status if anything has changed.\n<${appUrl}?view=mine|View your items →>`,
      });

      results.push({ email: owner.user_email, sent: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ email: owner.user_email, sent: false, error: msg });
    }
  }

  const allSent = results.every((r) => r.sent);
  return NextResponse.json({ ok: allSent, results });
}
