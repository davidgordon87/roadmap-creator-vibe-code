/**
 * scripts/sync-sheets.mjs
 *
 * Standalone CLI script that runs the full Sheets → Neon sync without
 * needing the Next.js dev server.  Mirrors the logic in lib/sheets/sync.ts
 * but as plain ESM so it can be executed directly with Node.
 *
 * Usage:
 *   node scripts/sync-sheets.mjs
 *
 * Reads credentials from .env.local automatically.
 */

import { readFileSync } from "fs";
import { google } from "googleapis";
import { neon } from "@neondatabase/serverless";

// ── load .env.local ───────────────────────────────────────────────────────────

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
    })
);

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_SHEETS_SPREADSHEET_IDS,
  GOOGLE_SHEETS_TAB_GID,
  DATABASE_URL,
  JIRA_BASE_URL,
} = env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error("✗ Missing Google OAuth vars in .env.local");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("✗ Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ── helpers ───────────────────────────────────────────────────────────────────

const LOE_MAP = { l: "S", lo: "S", low: "S", m: "M", med: "M", medium: "M", h: "L", hi: "L", high: "L" };
const norm = (s) => s.toLowerCase().trim();
const toInt = (s) => { const n = parseInt(s, 10); return isNaN(n) ? null : n; };
const toFloat = (s) => { const n = parseFloat(s); return isNaN(n) ? null : n; };

// ── sync one spreadsheet ──────────────────────────────────────────────────────

async function syncSpreadsheet(sheets, spreadsheetId, tabGid, jiraBaseUrl) {
  console.log(`  → spreadsheet ${spreadsheetId}`);

  // Resolve GID to sheet title
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = meta.data.sheets?.find((s) => s.properties?.sheetId === tabGid);
  const sheetTitle = sheetMeta?.properties?.title ?? "Sheet1";
  console.log(`     tab: "${sheetTitle}" (GID ${tabGid})`);

  // Fetch all values
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetTitle,
  });
  const rows = resp.data.values ?? [];
  if (rows.length < 2) {
    console.log("     no data rows — skipping");
    return 0;
  }

  const headers = rows[0].map(norm);
  const idx = (col) => headers.indexOf(norm(col));
  const cell = (row, col) => (row[idx(col)] ?? "").trim();

  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowId = `${spreadsheetId}::row::${i}`;
    const title = cell(row, "initiative");
    if (!title) continue;

    const loeLabelRaw = cell(row, "loe");
    const loeLabel = loeLabelRaw.toUpperCase() || null;
    const estimatedLoe = LOE_MAP[norm(loeLabelRaw)] ?? null;

    const upsertResult = await sql`
      INSERT INTO public.initiatives (
        title, description, status, source, sheets_row_id,
        estimated_loe, high_level_focus, loe_label, time_to_business_value,
        loe_score, value_score, alignment_score, avg_score,
        data_resources, sequence,
        da_resource_months, de_resource_months, ds_resource_months,
        jira_initiative_name, jira_epic_key, jira_epic_name
      ) VALUES (
        ${title},
        ${cell(row, "description") || null},
        'discovery', 'sheets', ${rowId},
        ${estimatedLoe},
        ${cell(row, "high-level focus") || null},
        ${loeLabel},
        ${cell(row, "time to business value") || null},
        ${toInt(cell(row, "loe score"))},
        ${toInt(cell(row, "value to business score"))},
        ${toInt(cell(row, "strategic alignment score"))},
        ${toFloat(cell(row, "avg score"))},
        ${cell(row, "data resources") || null},
        ${cell(row, "sequence") || null},
        ${toFloat(cell(row, "da resource months"))},
        ${toFloat(cell(row, "de resource months"))},
        ${toFloat(cell(row, "ds resource months"))},
        ${cell(row, "jira initiative name") || null},
        ${cell(row, "epic") || null},
        ${cell(row, "jira epic name") || null}
      )
      ON CONFLICT (sheets_row_id) DO UPDATE SET
        title                  = EXCLUDED.title,
        description            = EXCLUDED.description,
        estimated_loe          = EXCLUDED.estimated_loe,
        high_level_focus       = EXCLUDED.high_level_focus,
        loe_label              = EXCLUDED.loe_label,
        time_to_business_value = EXCLUDED.time_to_business_value,
        loe_score              = EXCLUDED.loe_score,
        value_score            = EXCLUDED.value_score,
        alignment_score        = EXCLUDED.alignment_score,
        avg_score              = EXCLUDED.avg_score,
        data_resources         = EXCLUDED.data_resources,
        sequence               = EXCLUDED.sequence,
        da_resource_months     = EXCLUDED.da_resource_months,
        de_resource_months     = EXCLUDED.de_resource_months,
        ds_resource_months     = EXCLUDED.ds_resource_months,
        jira_initiative_name   = EXCLUDED.jira_initiative_name,
        jira_epic_key          = EXCLUDED.jira_epic_key,
        jira_epic_name         = EXCLUDED.jira_epic_name,
        updated_at             = now()
      RETURNING id
    `;

    const initiativeId = upsertResult[0]?.id;
    if (!initiativeId) continue;

    const epicKey = cell(row, "epic");
    if (epicKey) {
      const base = (jiraBaseUrl ?? "https://jira.atlassian.net").replace(/\/$/, "");
      await sql`
        INSERT INTO public.jira_links (initiative_id, jira_key, jira_url)
        VALUES (${initiativeId}, ${epicKey}, ${base + "/browse/" + epicKey})
        ON CONFLICT (initiative_id, jira_key) DO UPDATE SET
          jira_url = EXCLUDED.jira_url
      `;
    }

    count++;
  }

  return count;
}

// ── main ──────────────────────────────────────────────────────────────────────

const spreadsheetIds = (GOOGLE_SHEETS_SPREADSHEET_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!spreadsheetIds.length) {
  console.error("✗ GOOGLE_SHEETS_SPREADSHEET_IDS is empty");
  process.exit(1);
}

const tabGid = parseInt(GOOGLE_SHEETS_TAB_GID ?? "0", 10);
const jiraBaseUrl = JIRA_BASE_URL?.replace(/\/$/, "") ?? null;

const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: "v4", auth: oauth2 });

const startMs = Date.now();
let total = 0;

console.log("\n── Google Sheets Sync ─────────────────────────────────────\n");

// Log sync start in DB
const logRes = await sql`
  INSERT INTO public.sync_log (sync_type, started_at, rows_processed)
  VALUES ('sheets_import', now(), 0)
  RETURNING id
`;
const logId = logRes[0].id;

try {
  for (const id of spreadsheetIds) {
    const n = await syncSpreadsheet(sheets, id, tabGid, jiraBaseUrl);
    total += n;
    console.log(`     ✓ ${n} rows upserted`);
  }

  await sql`
    UPDATE public.sync_log
    SET completed_at = now(), rows_processed = ${total}
    WHERE id = ${logId}
  `;

  const ms = Date.now() - startMs;
  console.log(`\n✓ Done — ${total} rows upserted across ${spreadsheetIds.length} sheet(s) in ${ms}ms\n`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  await sql`
    UPDATE public.sync_log
    SET completed_at = now(), rows_processed = ${total}, error_message = ${msg}
    WHERE id = ${logId}
  `;
  console.error("\n✗ Sync failed:", msg);
  process.exit(1);
}
