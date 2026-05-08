-- ============================================================
-- Roadmap Creator — Initial Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- initiatives
-- Core roadmap table. One row per initiative.
-- ------------------------------------------------------------
create table public.initiatives (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  description             text,
  status                  text not null default 'discovery'
                            check (status in ('discovery','planned','in_progress','complete','paused')),
  urgency                 smallint check (urgency between 1 and 5),
  revenue_impact          smallint check (revenue_impact between 1 and 5),
  risk_of_delay           smallint check (risk_of_delay between 1 and 5),
  business_alignment      smallint check (business_alignment between 1 and 5),
  estimated_loe           text check (estimated_loe in ('XS','S','M','L','XL')),
  source                  text not null default 'manual'
                            check (source in ('sheets','jira','manual')),
  sheets_row_id           text unique,
  canonical_initiative_id uuid references public.initiatives(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Auto-update updated_at on any row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger initiatives_updated_at
  before update on public.initiatives
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- initiative_owners
-- Many-to-many: users assigned to initiatives.
-- ------------------------------------------------------------
create table public.initiative_owners (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  user_email    text not null,
  clerk_user_id text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (initiative_id, user_email)
);

-- ------------------------------------------------------------
-- jira_links
-- Jira issue keys linked to an initiative, with cached metadata.
-- ------------------------------------------------------------
create table public.jira_links (
  id              uuid primary key default gen_random_uuid(),
  initiative_id   uuid not null references public.initiatives(id) on delete cascade,
  jira_key        text not null,
  jira_url        text not null,
  issue_title     text,
  issue_status    text,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (initiative_id, jira_key)
);

-- ------------------------------------------------------------
-- initiative_aliases
-- Records confirmed duplicate names from entity resolution.
-- ------------------------------------------------------------
create table public.initiative_aliases (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  alias_name    text not null,
  source        text,
  created_at    timestamptz not null default now(),
  unique (initiative_id, alias_name)
);

-- ------------------------------------------------------------
-- sync_log
-- Observability: one row per sync or resolution run.
-- ------------------------------------------------------------
create table public.sync_log (
  id             uuid primary key default gen_random_uuid(),
  sync_type      text not null
                   check (sync_type in ('sheets_import','entity_resolution','slack_reminder')),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  rows_processed integer not null default 0,
  error_message  text
);

-- ------------------------------------------------------------
-- Row Level Security
-- All tables locked down. The app uses the service role key
-- server-side only (bypasses RLS). No browser-direct DB access.
-- ------------------------------------------------------------
alter table public.initiatives        enable row level security;
alter table public.initiative_owners  enable row level security;
alter table public.jira_links         enable row level security;
alter table public.initiative_aliases enable row level security;
alter table public.sync_log           enable row level security;
