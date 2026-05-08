/**
 * Hand-authored TypeScript types for the Supabase schema.
 *
 * These are derived from the migration in
 * supabase/migrations/20260508165906_initial_schema.sql.
 *
 * After running `npx supabase gen types typescript --linked` you can
 * replace this file with the auto-generated output for full type safety.
 */

export type InitiativeStatus =
  | "discovery"
  | "planned"
  | "in_progress"
  | "complete"
  | "paused";

export type InitiativeSource = "sheets" | "jira" | "manual";

export type EstimatedLoe = "XS" | "S" | "M" | "L" | "XL";

export type SyncType = "sheets_import" | "entity_resolution" | "slack_reminder";

export interface Initiative {
  id: string;
  title: string;
  description: string | null;
  status: InitiativeStatus;
  urgency: number | null;
  revenue_impact: number | null;
  risk_of_delay: number | null;
  business_alignment: number | null;
  estimated_loe: EstimatedLoe | null;
  source: InitiativeSource;
  sheets_row_id: string | null;
  canonical_initiative_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InitiativeOwner {
  id: string;
  initiative_id: string;
  user_email: string;
  clerk_user_id: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface JiraLink {
  id: string;
  initiative_id: string;
  jira_key: string;
  jira_url: string;
  issue_title: string | null;
  issue_status: string | null;
  last_fetched_at: string | null;
  created_at: string;
}

export interface InitiativeAlias {
  id: string;
  initiative_id: string;
  alias_name: string;
  source: string | null;
  created_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: SyncType;
  started_at: string;
  completed_at: string | null;
  rows_processed: number;
  error_message: string | null;
}

// Minimal Database type used by the Supabase client generic
export interface Database {
  public: {
    Tables: {
      initiatives: { Row: Initiative; Insert: Omit<Initiative, "id" | "created_at" | "updated_at">; Update: Partial<Omit<Initiative, "id">> };
      initiative_owners: { Row: InitiativeOwner; Insert: Omit<InitiativeOwner, "id" | "created_at">; Update: Partial<Omit<InitiativeOwner, "id">> };
      jira_links: { Row: JiraLink; Insert: Omit<JiraLink, "id" | "created_at">; Update: Partial<Omit<JiraLink, "id">> };
      initiative_aliases: { Row: InitiativeAlias; Insert: Omit<InitiativeAlias, "id" | "created_at">; Update: Partial<Omit<InitiativeAlias, "id">> };
      sync_log: { Row: SyncLog; Insert: Omit<SyncLog, "id">; Update: Partial<Omit<SyncLog, "id">> };
    };
  };
}
