-- ============================================================
-- Add Google Sheets-specific columns to initiatives
-- ============================================================

alter table public.initiatives
  -- Jira references (raw from sheet; jira_links rows are also created)
  add column if not exists jira_initiative_name text,
  add column if not exists jira_epic_key        text,
  add column if not exists jira_epic_name       text,

  -- Sheet scoring columns (raw values from sheet)
  add column if not exists high_level_focus     text,
  add column if not exists loe_label            text,   -- L / M / H from the LOE column
  add column if not exists time_to_business_value text,
  add column if not exists loe_score            smallint,
  add column if not exists value_score          smallint,
  add column if not exists alignment_score      smallint,
  add column if not exists avg_score            numeric(5,2),

  -- Resource planning
  add column if not exists data_resources       text,
  add column if not exists sequence             text,
  add column if not exists da_resource_months   numeric(5,2),
  add column if not exists de_resource_months   numeric(5,2),
  add column if not exists ds_resource_months   numeric(5,2);
