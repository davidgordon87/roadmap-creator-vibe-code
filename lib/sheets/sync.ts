/**
 * Core Google Sheets → Neon sync logic.
 *
 * Called by the API route (app/api/sync/sheets/route.ts) and optionally
 * by a Netlify scheduled function in later milestones.
 *
 * Flow per spreadsheet:
 *   1. Resolve the tab GID → sheet title (needed for the range param)
 *   2. Fetch all values from that sheet
 *   3. Build a header→index map (case-insensitive)
 *   4. For each data row: upsert into `initiatives`, then upsert any
 *      Jira links derived from the EPIC column
 *   5. Log totals to `sync_log`
 */

import { google } from "googleapis";
import { DIRECT_COLUMN_MAP, JIRA_COLS, LOE_TO_ESTIMATED } from "./column-map";
import { getDb } from "@/lib/db/client";

// ── helpers ──────────────────────────────────────────────────────────────────

function toSmallint(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function toNumeric(raw: string): number | null {
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function normalise(s: string): string {
  return s.toLowerCase().trim();
}

// ── Google OAuth2 client ──────────────────────────────────────────────────────

export function buildSheetsClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  return google.sheets({ version: "v4", auth: oauth2 });
}

// ── per-spreadsheet sync ──────────────────────────────────────────────────────

async function syncSpreadsheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabGid: number,
  jiraBaseUrl: string | null
): Promise<number> {
  const sql = getDb();

  // 1. Resolve GID → sheet title
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = metaRes.data.sheets?.find(
    (s) => s.properties?.sheetId === tabGid
  );
  const sheetTitle = sheetMeta?.properties?.title ?? "Sheet1";

  // 2. Fetch all values
  const valRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetTitle,
  });
  const rows: string[][] = (valRes.data.values as string[][]) ?? [];
  if (rows.length < 2) return 0; // header only / empty

  // 3. Build header index map
  const headers = rows[0].map(normalise);
  const idx = (colName: string): number => headers.indexOf(normalise(colName));
  const cell = (row: string[], colName: string): string =>
    (row[idx(colName)] ?? "").trim();

  let processed = 0;

  // 4. Process data rows (rows[0] = header, rows[1..] = data)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowId = `${spreadsheetId}::row::${i}`; // stable key, 1-based data row

    const title = cell(row, "initiative");
    if (!title) continue; // skip blank rows

    const loeLabelRaw = cell(row, "loe");
    const loeLabel = loeLabelRaw.toUpperCase() || null;
    const estimatedLoe = LOE_TO_ESTIMATED[normalise(loeLabelRaw)] ?? null;

    const description = cell(row, "description") || null;
    const highLevelFocus = cell(row, DIRECT_COLUMN_MAP["high-level focus"] ? "high-level focus" : "high_level_focus") || null;
    const timeToBusinessValue = cell(row, "time to business value") || null;
    const loeScore = toSmallint(cell(row, "loe score"));
    const valueScore = toSmallint(cell(row, "value to business score"));
    const alignmentScore = toSmallint(cell(row, "strategic alignment score"));
    const avgScore = toNumeric(cell(row, "avg score"));
    const dataResources = cell(row, "data resources") || null;
    const sequence = cell(row, "sequence") || null;
    const daResourceMonths = toNumeric(cell(row, "da resource months"));
    const deResourceMonths = toNumeric(cell(row, "de resource months"));
    const dsResourceMonths = toNumeric(cell(row, "ds resource months"));
    const jiraInitiativeName = cell(row, JIRA_COLS.initiativeName) || null;
    const jiraEpicKey = cell(row, JIRA_COLS.epicKey) || null;
    const jiraEpicName = cell(row, JIRA_COLS.epicName) || null;

    // 5. Upsert into initiatives
    const upsertResult = await sql`
      INSERT INTO public.initiatives (
        title,
        description,
        status,
        source,
        sheets_row_id,
        estimated_loe,
        high_level_focus,
        loe_label,
        time_to_business_value,
        loe_score,
        value_score,
        alignment_score,
        avg_score,
        data_resources,
        sequence,
        da_resource_months,
        de_resource_months,
        ds_resource_months,
        jira_initiative_name,
        jira_epic_key,
        jira_epic_name
      )
      VALUES (
        ${title},
        ${description},
        'discovery',
        'sheets',
        ${rowId},
        ${estimatedLoe},
        ${highLevelFocus},
        ${loeLabel},
        ${timeToBusinessValue},
        ${loeScore},
        ${valueScore},
        ${alignmentScore},
        ${avgScore},
        ${dataResources},
        ${sequence},
        ${daResourceMonths},
        ${deResourceMonths},
        ${dsResourceMonths},
        ${jiraInitiativeName},
        ${jiraEpicKey},
        ${jiraEpicName}
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

    const initiativeId = (upsertResult[0] as { id: string } | undefined)?.id;
    if (!initiativeId) continue;

    // 6. Upsert jira_links for the epic key
    if (jiraEpicKey) {
      const jiraUrl = jiraBaseUrl
        ? `${jiraBaseUrl}/browse/${jiraEpicKey}`
        : `https://jira.atlassian.net/browse/${jiraEpicKey}`;

      await sql`
        INSERT INTO public.jira_links (initiative_id, jira_key, jira_url)
        VALUES (${initiativeId}, ${jiraEpicKey}, ${jiraUrl})
        ON CONFLICT (initiative_id, jira_key) DO UPDATE SET
          jira_url = EXCLUDED.jira_url
      `;
    }

    processed++;
  }

  return processed;
}

// ── main export ───────────────────────────────────────────────────────────────

export interface SyncResult {
  spreadsheets: string[];
  rowsProcessed: number;
  durationMs: number;
  error?: string;
}

export async function runSheetsSync(): Promise<SyncResult> {
  const sql = getDb();
  const start = Date.now();

  const spreadsheetIds = (process.env.GOOGLE_SHEETS_SPREADSHEET_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const tabGid = parseInt(process.env.GOOGLE_SHEETS_TAB_GID ?? "0", 10);
  const jiraBaseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "") ?? null;

  if (!spreadsheetIds.length) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_IDS is not set");
  }

  // Log sync start
  const logRes = await sql`
    INSERT INTO public.sync_log (sync_type, started_at, rows_processed)
    VALUES ('sheets_import', now(), 0)
    RETURNING id
  `;
  const logId = (logRes[0] as { id: string }).id;

  let totalRows = 0;
  let errorMessage: string | null = null;

  try {
    const sheets = buildSheetsClient();

    for (const spreadsheetId of spreadsheetIds) {
      const count = await syncSpreadsheet(sheets, spreadsheetId, tabGid, jiraBaseUrl);
      totalRows += count;
    }

    // Update log on success
    await sql`
      UPDATE public.sync_log
      SET completed_at    = now(),
          rows_processed  = ${totalRows}
      WHERE id = ${logId}
    `;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);

    await sql`
      UPDATE public.sync_log
      SET completed_at  = now(),
          rows_processed = ${totalRows},
          error_message  = ${errorMessage}
      WHERE id = ${logId}
    `;

    throw err;
  }

  return {
    spreadsheets: spreadsheetIds,
    rowsProcessed: totalRows,
    durationMs: Date.now() - start,
  };
}
