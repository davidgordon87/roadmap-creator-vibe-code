/**
 * Server-side data access for the initiatives table.
 * Always runs on the server — never import this from a Client Component.
 */

import { getDb } from "@/lib/db/client";

export interface JiraLinkRow {
  id: string;
  jira_key: string;
  jira_url: string;
  issue_title: string | null;
  issue_status: string | null;
}

export interface OwnerRow {
  id: string;
  user_email: string;
  is_primary: boolean;
}

export interface InitiativeRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  estimated_loe: string | null;
  loe_label: string | null;
  high_level_focus: string | null;
  loe_score: number | null;
  value_score: number | null;
  alignment_score: number | null;
  /** numeric(5,2) — Neon returns numeric columns as strings */
  avg_score: string | null;
  data_resources: string | null;
  sequence: string | null;
  jira_initiative_name: string | null;
  jira_epic_key: string | null;
  jira_epic_name: string | null;
  sheets_row_id: string | null;
  updated_at: string;
  created_at: string;
  jira_links: JiraLinkRow[];
  owners: OwnerRow[];
}

/**
 * Returns all non-duplicate initiatives, newest-updated first,
 * with their associated jira_links and owners aggregated.
 */
export async function getAllInitiatives(): Promise<InitiativeRow[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      i.id,
      i.title,
      i.description,
      i.status,
      i.source,
      i.estimated_loe,
      i.loe_label,
      i.high_level_focus,
      i.loe_score,
      i.value_score,
      i.alignment_score,
      i.avg_score,
      i.data_resources,
      i.sequence,
      i.jira_initiative_name,
      i.jira_epic_key,
      i.jira_epic_name,
      i.sheets_row_id,
      i.updated_at,
      i.created_at,
      COALESCE(
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'id',           j.id,
            'jira_key',     j.jira_key,
            'jira_url',     j.jira_url,
            'issue_title',  j.issue_title,
            'issue_status', j.issue_status
          )
        ) FILTER (WHERE j.id IS NOT NULL),
        '[]'
      ) AS jira_links,
      COALESCE(
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'id',         o.id,
            'user_email', o.user_email,
            'is_primary', o.is_primary
          )
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'
      ) AS owners
    FROM public.initiatives i
    LEFT JOIN public.jira_links j        ON j.initiative_id = i.id
    LEFT JOIN public.initiative_owners o ON o.initiative_id = i.id
    WHERE i.canonical_initiative_id IS NULL
    GROUP BY i.id
    ORDER BY i.avg_score DESC NULLS LAST, i.updated_at DESC
  `;

  return rows as InitiativeRow[];
}
