# plan.md — Roadmap Creator: Implementation ExecPlan

---

## Purpose / Big Picture

This plan guides a developer from an empty repository to a fully deployed, production-ready internal roadmap tool. The finished application lets a team view, edit, and own roadmap initiatives that are sourced from a Google Sheet and enriched with Jira issue details. Users log in through a company-restricted auth gate, can toggle between the full roadmap and their personal "My Items" view, and receive monthly Slack reminders to review and update their initiatives.

The application is a Next.js 15 web app deployed on Netlify. All data is persisted in Supabase (Postgres). Google Sheets is treated as the authoritative source of record for initial roadmap content; edits made in the UI are stored in Supabase and are not written back to the Sheet. Jira issue links are stored in Supabase and enriched on demand from the Atlassian REST API. Monthly Slack messages are dispatched by a Netlify Scheduled Function.

Every milestone in this plan produces independently verifiable behavior — meaning you can stop after any milestone, deploy, and confirm the app works up to that point before proceeding.

---

## Context and Orientation

**Repository state at time of planning:** The repository contains only `README.md`, a `prompts/` directory (planning artifacts), and `research.md`. There is no application code yet. This plan starts from a blank slate.

**Key commands you will use throughout:**

Running the development server locally: `npm run dev` starts the Next.js dev server on `http://localhost:3000`.

Running the Netlify CLI locally: `netlify dev` starts a local emulator of the Netlify environment, including serverless functions and scheduled functions. This is required for testing Background and Scheduled Functions before deploy.

Applying Supabase migrations: `npx supabase db push` (or `npx supabase migration up`) applies pending SQL migration files to the linked Supabase project.

Deploying to Netlify: pushing to the `main` branch on GitHub triggers an automatic Netlify deploy. You can also trigger a manual deploy with `netlify deploy --prod` from the CLI.

**Glossary of non-obvious terms used in this plan:**

An *initiative* is the top-level unit of the roadmap — a named project or body of work with associated metadata (owner, status, urgency, etc.). Initiatives may have one or more sub-tasks but the roadmap UI treats initiatives as the primary row.

*Server Actions* are Next.js App Router functions that run on the server and are called directly from React components, without writing a separate API endpoint. They are the recommended way to handle form submissions and mutations in App Router.

*Netlify Scheduled Function* is a serverless function that executes on a cron schedule (like a Unix cron job) without needing an HTTP request to trigger it. Netlify runs it automatically.

*Netlify Background Function* is a serverless function with up to 15 minutes of execution time, suitable for slow operations like LLM calls or bulk API reads. The HTTP response returns immediately with a 202 and the work completes asynchronously.

*shadcn/ui* is a collection of copy-paste React components built on top of Radix UI primitives and styled with Tailwind CSS. Unlike a component library you install as a dependency, shadcn/ui components live in your repository under `components/ui/` and you own the source — meaning you can customize them freely.

*RBAC* (Role-Based Access Control) means different users see and can do different things based on their assigned role. In this app there are two roles: `admin` (full edit, delete, and user management) and `contributor` (view and edit, no delete or user management).

---

## Stack Summary (from research.md)

The following decisions are sourced directly from `research.md` and are treated as binding constraints for this plan. Any deviation is recorded in the Decision Log section at the bottom.

The framework is Next.js 15 with the App Router, deployed to Netlify via `@netlify/plugin-nextjs`. Authentication and access control use Clerk with two custom roles: `admin` and `contributor`. The persistence layer is Supabase (Postgres). The UI component system is shadcn/ui with Tailwind CSS, including dark mode. Data is imported from Google Sheets via a Google service account and a Netlify Background Function. Jira issue details are fetched server-side via the Atlassian Cloud REST API using an API token stored as a Netlify environment variable. Monthly Slack reminders are sent by a Netlify Scheduled Function using the Slack Bolt SDK. Entity resolution across disparate project names uses a hybrid pipeline of `fuse.js` fuzzy matching followed by Claude API disambiguation. State is cached client-side with `@tanstack/react-query` v5.

---

## Plan of Work

Each milestone below is independently deployable. Complete and verify each one before starting the next.

### Milestone 1 — Project Bootstrap and Deployment Pipeline

The goal of this milestone is a "Hello World" Next.js app deployed live on Netlify with authentication scaffolded. No actual features yet — just a sign-in page, a protected placeholder home page, and a green Netlify build.

You will scaffold a new Next.js 15 app with the App Router, TypeScript, and Tailwind CSS. Then you will add the `@netlify/plugin-nextjs` Netlify adapter and a `netlify.toml` configuration file. You will connect the GitHub repository to a Netlify site and push the branch, confirming the build passes. Then you will install and configure Clerk: wrapping the app in the Clerk provider, adding the `authMiddleware` that redirects unauthenticated users to the Clerk-hosted sign-in page, and verifying that `localhost:3000` prompts for sign-in when no session exists.

shadcn/ui is initialized during this milestone. Run the shadcn/ui CLI to scaffold the `components/ui/` directory and the Tailwind config additions it requires. Enable dark mode using the `class` strategy (shadcn/ui's recommended approach), which means adding a `dark` class to the `<html>` element to toggle modes. Add a theme toggle button to the layout so you can verify dark mode works visually.

Milestone 1 is complete when: the Netlify build log shows a green deploy, navigating to the Netlify URL redirects to Clerk sign-in, signing in with a valid account lands you on a placeholder home page, and toggling the theme button switches the page between light and dark mode.

### Milestone 2 — Supabase Data Layer

The goal is to have the database schema in place and a verified connection from the Next.js app to Supabase.

Create a new Supabase project. Install the Supabase CLI locally and link it to the project. Create the following tables via SQL migration files (never edit the database schema by hand in the Supabase dashboard — always use migration files so the schema is reproducible):

The `initiatives` table is the core table. Each row represents one roadmap initiative. Columns: a UUID primary key, `title` (text, not null), `description` (text), `status` (text — valid values: `discovery`, `planned`, `in_progress`, `complete`, `paused`), `urgency` (integer 1–5), `revenue_impact` (integer 1–5), `risk_of_delay` (integer 1–5), `business_alignment` (integer 1–5), `estimated_loe` (text — valid values: `XS`, `S`, `M`, `L`, `XL`), `source` (text — `sheets`, `jira`, or `manual`), `sheets_row_id` (text, nullable — the original row identifier from the Google Sheet for idempotent upserts), `canonical_initiative_id` (UUID, nullable, self-referencing foreign key — used by the entity resolution pipeline to point a duplicate at its canonical record), `created_at` (timestamptz, default now()), `updated_at` (timestamptz, default now()).

The `initiative_owners` table associates users with initiatives. Columns: UUID primary key, `initiative_id` (UUID foreign key to `initiatives`), `user_email` (text, not null), `clerk_user_id` (text, nullable — populated when the user has logged in and their Clerk ID is known), `is_primary` (boolean, default false), `created_at` (timestamptz).

The `jira_links` table stores Jira issue references attached to an initiative. Columns: UUID primary key, `initiative_id` (UUID foreign key), `jira_key` (text, not null — e.g., `PROJ-123`), `jira_url` (text, not null), `issue_title` (text, nullable — cached from last Jira API fetch), `issue_status` (text, nullable — cached), `last_fetched_at` (timestamptz, nullable).

The `initiative_aliases` table is used by the entity resolution pipeline to record when two differently-named initiatives are confirmed as the same thing. Columns: UUID primary key, `initiative_id` (UUID foreign key to the canonical initiative), `alias_name` (text, not null), `source` (text — where this alias name came from), `created_at` (timestamptz).

The `sync_log` table records every time the Google Sheets import runs, for observability. Columns: UUID primary key, `sync_type` (text — `sheets_import`, `entity_resolution`), `started_at` (timestamptz), `completed_at` (timestamptz, nullable), `rows_processed` (integer, default 0), `error_message` (text, nullable).

Add Row Level Security policies to `initiatives` and related tables so that only authenticated users (verified via Supabase's `auth.uid()` or a service role key) can read and write rows. For this internal tool, a simpler approach is to use the Supabase service role key on the server side only and never expose it to the client — all database access goes through Next.js Server Actions or API routes.

Milestone 2 is complete when: `npx supabase db push` runs without errors, the Supabase dashboard shows all five tables, and a test API route at `/api/health` returns a JSON object with a `db: "ok"` field after successfully pinging the `sync_log` table.

### Milestone 3 — Google Sheets Import

The goal is a working sync pipeline that reads your Google Sheet and populates the `initiatives` table in Supabase.

Create a Google Cloud project and a service account with no special roles. Download the service account's JSON key file. Share your Google Sheet with the service account's email address (the one ending in `@your-project.iam.gserviceaccount.com`) as a Viewer. Store the service account private key and client email as Netlify environment variables — never commit the JSON key to the repository.

Build a Netlify Background Function at `netlify/functions/sheets-sync-bg.ts`. This function is triggered by a POST request to `/.netlify/functions/sheets-sync-bg`. It uses the Google Sheets REST API (via `googleapis` npm package) with service account credentials to read the target spreadsheet. It maps each row to the columns defined in the `initiatives` schema. It upserts rows into Supabase using `sheets_row_id` as the conflict key, so running the sync twice does not create duplicate rows.

Define the column mapping between your Google Sheet and the `initiatives` schema in a configuration file (not hardcoded in the function) so it can be updated without touching the function logic. The mapping lists each sheet column header and which database field it maps to.

Also build a Netlify Scheduled Function at `netlify/functions/sheets-sync-scheduled.ts` that runs on a daily cron schedule (`0 6 * * *` — 6 AM UTC daily) and simply calls the Background Function. The Scheduled Function itself does no data work; it just fires the trigger. This separation keeps the Scheduled Function within the 10-second synchronous limit.

Milestone 3 is complete when: sending a POST to `/.netlify/functions/sheets-sync-bg` (via `curl` or a browser fetch in the dev console) with valid credentials causes rows to appear in the Supabase `initiatives` table, and the `sync_log` table shows a completed sync record with a non-zero `rows_processed` count. Running the sync a second time does not create duplicate rows.

### Milestone 4 — Roadmap View (Read-Only)

The goal is a polished, read-only roadmap table visible to any authenticated user.

Build the main page at `app/(dashboard)/page.tsx`. This is a React Server Component that fetches all initiatives from Supabase on the server and passes them to a client component for rendering. Using a Server Component for the initial fetch means the table is server-rendered and immediately visible without a loading spinner on first load.

The roadmap table displays one initiative per row. Visible columns: Title, Owner(s), Status (rendered as a colored badge), Priority Score (a computed value derived from urgency + revenue impact + risk + alignment, displayed as a number out of 20), Estimated LOE, Jira Links (rendered as clickable badge chips showing the Jira key, e.g., `PROJ-123`), and Last Updated.

Jira link badges are links that open the Jira issue in a new tab. A tooltip on hover shows the cached issue title and status (from the `jira_links.issue_title` and `issue_status` columns). If those cached values are empty (new link that has never been fetched), the tooltip shows "Loading…" and a client-side effect fires a request to `/api/jira/[key]` to fetch and cache the details.

Owner cells display each owner's email as a tag. If the owner has a `clerk_user_id` and a profile photo, show the avatar; otherwise show initials in a circle using shadcn/ui's `Avatar` component.

The layout includes a top navigation bar with the app name, the user's avatar (from Clerk), a sign-out button, and the dark mode toggle. The navigation bar is a shared server component in `app/(dashboard)/layout.tsx`.

Milestone 4 is complete when: after signing in, the home page shows a table populated with the rows imported from the Google Sheet in Milestone 3, Jira link badges are visible for any rows that have Jira keys in the `jira_links` table, and hovering a badge shows the tooltip. The page is readable in both light and dark mode.

### Milestone 5 — Edit and Modify Roadmap

The goal is inline editing of initiative fields, persisted to Supabase via Server Actions.

Clicking any cell in the Title, Status, Urgency, Revenue Impact, Risk, Alignment, LOE, or Description columns opens an inline editor for that field. For text fields (Title, Description), this is a shadcn/ui `Input` or `Textarea`. For enumerated fields (Status, LOE), it is a `Select` dropdown. For scored fields (Urgency, Revenue Impact, Risk, Alignment), it is a set of five radio buttons styled as buttons (1–5).

Pressing Enter or clicking outside the edited cell submits the change via a Next.js Server Action. The Server Action validates the value, updates the row in Supabase, and returns the updated row. The client uses `@tanstack/react-query`'s `useMutation` to handle optimistic updates — the cell immediately shows the new value before the server confirms, and reverts if the Server Action returns an error.

Editing is available to both `admin` and `contributor` roles. Deleting an initiative (a "Delete" button visible in a row actions menu) is available only to `admin` role. The role is read from the Clerk session on the server; the delete button is never rendered for `contributor` users (server-side gating, not just hidden in CSS).

Adding a new Jira link to an initiative opens a small modal (shadcn/ui `Dialog`) with a single text input for the Jira issue key. On submit, the app constructs the full Jira URL from a base URL stored in environment variables, saves it to the `jira_links` table, and immediately fetches the issue title and status from the Atlassian API to populate the cached fields.

Milestone 5 is complete when: editing a Title cell updates the value and the change persists after a full page reload; a `contributor` user does not see the Delete button; an `admin` user can delete an initiative and it disappears from the table; adding a Jira link creates a new badge in the row.

### Milestone 6 — Tagged View ("My Items")

The goal is a user-specific filter that shows only the initiatives where the signed-in user is listed as an owner.

Add a toggle control to the top of the roadmap page — two radio-style buttons labeled "All Items" and "My Items". The active filter is reflected in the URL as a query parameter: `?view=all` (default) and `?view=mine`. This means the filtered view is bookmarkable and shareable.

When `?view=mine` is active, the server fetches only initiatives where `initiative_owners.user_email` matches the signed-in user's primary email address from their Clerk session. Because this filter runs on the server, there is no client-side data leakage — users cannot see initiatives they do not own by manipulating the URL.

If the signed-in user has no owned initiatives, the "My Items" view shows an empty state with a message and a button to create a new initiative (links to the intake form from Milestone 10).

Milestone 6 is complete when: switching to "My Items" shows only initiatives where the current user's email is in the `initiative_owners` table, the URL updates to `?view=mine`, reloading the page preserves the filter, and a user with no owned initiatives sees the empty state message.

### Milestone 7 — Jira Issue Enrichment

The goal is live Jira issue data surfaced as tooltips on Jira link badges.

Build an API route at `app/api/jira/[key]/route.ts`. This route accepts a Jira issue key (e.g., `PROJ-123`), calls the Atlassian Cloud REST API at `https://your-domain.atlassian.net/rest/api/3/issue/{key}` using an API token stored in environment variables, and returns a JSON object with the issue's `summary` (title), `status.name`, and `assignee.displayName`. It also upserts these values into the `jira_links` table so subsequent loads use the cached version without hitting Jira.

The Atlassian REST API uses HTTP Basic Auth where the username is your Atlassian account email and the password is an API token generated at `id.atlassian.com/manage-profile/security/api-tokens`. Store both as Netlify environment variables (`JIRA_EMAIL` and `JIRA_API_TOKEN`). The Jira base domain (e.g., `your-company.atlassian.net`) is also stored as `JIRA_BASE_URL`.

On the roadmap page, when a user hovers a Jira badge that has no cached title, the client fires a fetch to `/api/jira/[key]` and displays the result in the tooltip. Subsequent hovers use the cached database value (fetched during server render) and do not hit the API again until the cache is more than 24 hours old.

Milestone 7 is complete when: hovering a Jira badge that has no cached data shows a loading state, then populates with the live issue title and status; hovering again immediately shows the cached data without a loading state; the Supabase `jira_links` table shows populated `issue_title`, `issue_status`, and `last_fetched_at` columns after the hover.

### Milestone 8 — Slack Monthly Reminders

The goal is a Slack bot that sends personalized monthly DMs to project owners prompting them to review their roadmap items.

First, create a Slack app at `api.slack.com/apps`. Add the following Bot Token Scopes: `chat:write`, `users:read`, `users:read.email`. Install the app to your workspace. Copy the Bot User OAuth Token (starts with `xoxb-`) and store it as `SLACK_BOT_TOKEN` in Netlify environment variables.

Build the Netlify Scheduled Function at `netlify/functions/slack-reminders.ts`. Configure it with the cron expression `0 9 1 * *`, which fires at 9 AM UTC on the 1st of every month. The function:

First queries Supabase for all initiatives that have at least one owner and are not in `complete` status — these are the active initiatives that need monthly attention.

Then groups the active initiatives by owner email, so each owner gets a single message listing all their initiatives rather than one message per initiative.

Then, for each owner email, calls the Slack API's `users.lookupByEmail` method to resolve the email to a Slack Member ID (the format `U12345ABC`). If the lookup fails (the user is not in the Slack workspace), it logs the failure to `sync_log` and skips that owner.

Then calls `chat.postMessage` with `channel` set to the Member ID (posting to a Member ID sends a DM) and a message body that lists each active initiative title and a direct link to the app's `?view=mine` filtered view.

Because `chat.scheduleMessage` can only schedule messages up to 120 days in advance (per the risk note in `research.md`), this function posts immediately rather than pre-scheduling. The Scheduled Function's monthly cadence provides the timing.

Milestone 8 is complete when: manually invoking the Scheduled Function (via `netlify functions:invoke slack-reminders` in the CLI) sends a DM to the Slack account of at least one project owner in the database, and that DM contains a correct link to the app.

### Milestone 9 — LLM Entity Resolution

The goal is an automated pipeline that detects and links initiatives that appear under different names in different sources (e.g., "Customer Portal Redesign" in Jira and "Portal Revamp" in Google Sheets) so they display as one canonical initiative in the UI.

Build a Netlify Background Function at `netlify/functions/entity-resolution-bg.ts`. This function runs after each Google Sheets sync (the Sheets sync function calls it on completion). It:

First fetches all initiative titles from the `initiatives` table that do not yet have a `canonical_initiative_id` set — these are candidates for deduplication.

Runs a `fuse.js` fuzzy search across all titles to group candidates with a similarity score above a configurable lower threshold (e.g., 0.4) and below an upper threshold (e.g., 0.9). Pairs above 0.9 are treated as obvious matches and merged immediately without LLM involvement. Pairs below 0.4 are dismissed as unrelated. Pairs in the middle band go to Claude.

For the middle-band pairs, calls the Claude API with a structured prompt that presents two initiative titles and asks Claude to return a JSON object with three fields: `same_initiative` (boolean), `canonical_name` (string — the better of the two names, or a suggested improved name), and `confidence` (high/medium/low). Only `same_initiative: true` with `confidence: high` or `medium` results in a merge.

A merge means: setting the `canonical_initiative_id` on the duplicate row to point to the canonical row's ID, and inserting a record in `initiative_aliases` with the duplicate's name as the alias.

The roadmap view filters out rows where `canonical_initiative_id` is not null (i.e., duplicates are hidden). A small "Also known as" section in the initiative detail panel shows the aliases.

All Claude API responses are stored in the database before acting on them, so the pipeline can be rerun idempotently — it skips pairs that are already in `initiative_aliases`.

Milestone 9 is complete when: seeding the database with two initiatives having similar names (e.g., "Customer Portal Redesign" and "Portal Revamp") and running the entity resolution function causes one of them to disappear from the main roadmap table and appear as an alias in the other's detail panel. Running the function a second time produces no changes.

### Milestone 10 — Initiative Intake Form

The goal is a structured form at `/new` that lets users create a new roadmap initiative by answering a set of scoping questions.

The intake form lives at `app/(dashboard)/new/page.tsx`. It presents the following fields in a wizard-style layout (one section per screen to avoid overwhelming the user):

Section 1 — Basic Information: Initiative Title (required text input), Description (multi-line text area), Team / Department (text input or select from a list).

Section 2 — Impact Assessment: Urgency (1–5 scale with label descriptions: 1 = "Nice to have", 5 = "Business-critical / compliance deadline"), Revenue Impact (1–5: "No direct revenue impact" to "Major revenue driver or cost avoidance"), Risk of Delayed Implementation (1–5: "No meaningful risk" to "Regulatory, legal, or churn risk"), Business Initiative Alignment (1–5: "Tangential" to "Core strategic initiative").

Section 3 — Resource Scoping: Estimated Level of Effort (XS / S / M / L / XL with descriptions of what each means in team-weeks), Number of Teams Involved (free text), Key Dependencies (multi-line text), Known Blockers (multi-line text).

Section 4 — Stakeholders: Primary Owner (email input, auto-populated with the current user's email), Additional Owners / Co-owners (multi-value email input), Slack handles are not entered here — they are pulled from Clerk user metadata.

Section 5 — Jira Links: One or more Jira issue keys associated with this initiative (optional; user can skip).

On submission, a Server Action creates the initiative in Supabase, creates `initiative_owners` rows, and creates `jira_links` rows. It then calls the Claude API to synthesize the intake answers into a one-sentence initiative summary that is auto-populated into the `description` field (the user can edit it before finalizing). The user is redirected to the main roadmap page with the new initiative visible and highlighted.

Milestone 10 is complete when: completing the intake form and submitting it creates a new row in the `initiatives` and `initiative_owners` tables, the new initiative appears on the main roadmap page, and the auto-generated Claude summary is visible in the description field.

### Milestone 11 — Production Deploy and Hardening

The goal is a fully deployed, production-ready application with all environment variables set, error boundaries in place, and all acceptance criteria verified.

Confirm the Netlify site is connected to the GitHub `main` branch for automatic deploys. In the Netlify dashboard under Site Settings → Environment Variables, verify all of the following are set: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `SLACK_BOT_TOKEN`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_URL` (the Netlify site URL, used for generating links in Slack messages).

Add a global error boundary component to the app layout so that uncaught errors render a friendly error page rather than a blank screen. Add `loading.tsx` files for the main dashboard and intake form routes to show skeleton loaders during server-side data fetching.

Verify that all Netlify functions (Background, Scheduled) appear in the Netlify dashboard under Functions and that the Scheduled Function shows its next execution time.

Run the full acceptance checklist (see Validation and Acceptance section) against the production URL.

Milestone 11 is complete when all acceptance criteria pass against the live Netlify URL.

---

## Concrete Steps

This section provides the exact commands to run for each milestone. Run them in the order listed. All commands assume you are in the repository root unless otherwise noted.

### Bootstrap (Milestone 1)

Scaffold the Next.js app. Accept defaults except: choose TypeScript (yes), choose Tailwind (yes), choose App Router (yes), choose `src/` directory (no — keep flat), choose import alias (`@/*`):

    npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"

Expected output: files created including `app/`, `components/`, `next.config.ts`, `tailwind.config.ts`, `package.json`. Running `npm run dev` after this step should open a default Next.js welcome page at `localhost:3000`.

Install Netlify dependencies and create the Netlify config:

    npm install @netlify/plugin-nextjs
    touch netlify.toml

The `netlify.toml` file should specify the build command as `npm run build`, publish directory as `.next`, and include the `@netlify/plugin-nextjs` plugin declaration.

Install and initialize shadcn/ui:

    npx shadcn@latest init

When prompted, select: Style = New York, Base color = Slate, CSS variables = yes. This creates `components/ui/`, updates `tailwind.config.ts`, and creates `components.json`.

Add the specific shadcn/ui components needed throughout the app. Run this once now to add them all:

    npx shadcn@latest add button input textarea select dialog badge avatar tooltip table dropdown-menu radio-group switch label card skeleton

Expected output: each component file appears under `components/ui/`.

Install Clerk:

    npm install @clerk/nextjs

Create a Clerk application at `dashboard.clerk.com`. Copy the publishable key and secret key. Create a `.env.local` file (never committed to git — add it to `.gitignore`) with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

Commit and push to `main`. Watch the Netlify dashboard — the build should pass (no env vars needed yet for a placeholder page). The Netlify URL should load the app and redirect to Clerk sign-in.

### Supabase Setup (Milestone 2)

Install Supabase CLI and client:

    npm install -D supabase
    npm install @supabase/supabase-js
    npx supabase login
    npx supabase init
    npx supabase link --project-ref YOUR_PROJECT_REF

Create the first migration file:

    npx supabase migration new initial_schema

Edit the generated file in `supabase/migrations/` to contain the SQL CREATE TABLE statements for `initiatives`, `initiative_owners`, `jira_links`, `initiative_aliases`, and `sync_log` as described in Milestone 2. Then apply it:

    npx supabase db push

Expected output: "Applying migration...done" with no errors. Open the Supabase dashboard Table Editor and confirm all five tables exist with the correct columns.

Add the Supabase URL and anon key (from Supabase dashboard → Settings → API) to `.env.local`. Add the service role key as well (for server-side use only — never pass this to the client). Create a `lib/supabase/server.ts` module that exports a Supabase client using the service role key for use in Server Actions and API routes, and a `lib/supabase/client.ts` module that exports a browser-safe client using the anon key.

### Google Sheets Sync (Milestone 3)

Install the Google APIs client library:

    npm install googleapis

Create the directory for Netlify functions if it does not exist:

    mkdir -p netlify/functions

Create `netlify/functions/sheets-sync-bg.ts` (Background Function) and `netlify/functions/sheets-sync-scheduled.ts` (Scheduled Function with cron `0 6 * * *`).

Add the following to `.env.local` for local testing: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (the multi-line PEM key — in Netlify dashboard this is stored as-is; in `.env.local` replace newlines with `\n`), and `GOOGLE_SHEETS_SPREADSHEET_ID`.

Test the sync locally:

    netlify dev

Then in a separate terminal:

    netlify functions:invoke sheets-sync-bg --no-identity

Expected output in the Netlify dev terminal: logs showing rows read from the sheet and upserted to Supabase. Checking the Supabase `initiatives` table should show populated rows. The `sync_log` table should show one record with `sync_type = 'sheets_import'` and a non-null `completed_at`.

### Jira Enrichment Setup (Milestone 7)

Add Jira credentials to `.env.local`:

    JIRA_BASE_URL=https://your-company.atlassian.net
    JIRA_EMAIL=your-email@company.com
    JIRA_API_TOKEN=your-api-token

Generate the API token at: `https://id.atlassian.com/manage-profile/security/api-tokens`.

Test the Jira API route locally by navigating to `http://localhost:3000/api/jira/YOUR-ISSUE-KEY` in the browser. The response should be a JSON object with `summary`, `status`, and `assignee` fields.

### Slack Bot Setup (Milestone 8)

Install Slack SDK:

    npm install @slack/web-api

(The `@slack/bolt` package is the full Bolt framework recommended in `research.md`, but for this app's use case of outbound-only messages, the lighter `@slack/web-api` package is sufficient. See Decision Log.)

Add `SLACK_BOT_TOKEN` to `.env.local`.

Test the Scheduled Function locally:

    netlify functions:invoke slack-reminders --no-identity

Expected output: a DM arrives in the Slack workspace from the bot. Check the `sync_log` table for a record of the invocation.

### Entity Resolution Setup (Milestone 9)

Install dependencies:

    npm install fuse.js @anthropic-ai/sdk

Add `ANTHROPIC_API_KEY` to `.env.local`.

Test the entity resolution function by first seeding the `initiatives` table with two rows having similar names, then running:

    netlify functions:invoke entity-resolution-bg --no-identity

Expected output: console logs showing the fuzzy match candidates, Claude's judgment, and the resulting merge. One of the two test initiatives should disappear from the main roadmap query and appear as an alias.

---

## Validation and Acceptance

These are the human-verifiable behaviors that define "done." Run through this checklist against the production Netlify URL after Milestone 11.

Authentication gate: navigating to the app URL without a session redirects to the Clerk sign-in page. After signing in, the roadmap page loads. Signing out redirects back to sign-in.

Role enforcement: a user with `contributor` role does not see the Delete button in initiative row menus. A user with `admin` role sees it and can use it.

Roadmap view: the main page displays all active initiatives as table rows. Each row shows title, owner badges, status badge, priority score, LOE, and Jira link badges. The table is readable in both light and dark mode.

Jira enrichment: hovering a Jira badge shows a tooltip with the issue title and status. After hovering, reloading the page still shows the cached title and status without a new Jira API call.

Editing: clicking a cell opens an inline editor, changing the value and pressing Enter updates the cell immediately (optimistic), and reloading the page shows the new value.

Tagged view: clicking "My Items" filters the table to only show initiatives owned by the signed-in user. The URL changes to `?view=mine`. Reloading the page preserves the filter.

Intake form: navigating to `/new` shows the five-section intake wizard. Completing it and submitting creates a new initiative that appears on the roadmap page. The description field is pre-populated with a Claude-generated summary.

Slack reminder: manually invoking the `slack-reminders` function from the Netlify dashboard (Functions → slack-reminders → Invoke) sends a DM to at least one project owner in Slack.

Entity resolution: seeding two initiatives with similar names and invoking the `entity-resolution-bg` function from the Netlify dashboard causes one to be hidden and its name to appear as an alias in the other's detail panel. Invoking again produces no changes.

Persistence: all changes survive a full page reload. Changes survive a new deployment (data is in Supabase, not in-memory or in Netlify's ephemeral function environment).

---

## Idempotence and Recovery

**Supabase migrations:** Migrations are numbered and tracked in the `supabase/migrations/` directory. Running `npx supabase db push` a second time is safe — it only applies migrations that have not yet been applied. To reset the database during development, run `npx supabase db reset` (this destroys all data — never run against production). To recover a broken migration, drop the problematic table in Supabase dashboard and delete the migration file, then create a corrected one.

**Google Sheets sync:** The sync function uses `sheets_row_id` as the upsert key. Running the sync multiple times is safe — it updates existing rows rather than inserting duplicates. If a row was deleted from the database but still exists in the sheet, it will be re-inserted on next sync. If a column mapping is wrong, fix the config file and re-run — existing rows will be updated to the corrected values.

**Entity resolution:** The pipeline skips initiative pairs that already have a record in `initiative_aliases`. To re-evaluate a pair (e.g., to override a wrong Claude decision), delete the relevant row from `initiative_aliases` and re-run. To undo a merge, set `canonical_initiative_id` to null on the incorrectly merged initiative and delete the `initiative_aliases` row.

**Netlify environment variables:** If a Netlify function fails due to a missing environment variable, add the variable in the Netlify dashboard (Site Settings → Environment Variables) and trigger a new deploy. Functions pick up new env vars without a code change.

**Clerk user roles:** Roles are assigned in the Clerk dashboard (Users → select user → Metadata → Add role). If a user is missing a role, they default to no permissions on gated actions. Add the role in Clerk and the change takes effect on their next request.

**Partial deploys:** If a deploy succeeds on Netlify but a function fails at runtime, the previous working version is still live. Netlify keeps the last successful deploy and you can roll back via the Netlify dashboard (Deploys → select previous deploy → Publish deploy).

---

## Interfaces and Dependencies

All decisions below reflect `research.md`. Deviations are recorded in Decision Log.

**Next.js 15 (App Router)** is the application framework. All pages live under `app/`. Server Actions handle mutations. API routes under `app/api/` handle client-initiated data fetches (Jira enrichment) and webhook endpoints.

**`@netlify/plugin-nextjs` (latest)** adapts the Next.js build for Netlify. It is declared in `netlify.toml` under `[[plugins]]`. No special configuration is required beyond that declaration.

**Clerk (`@clerk/nextjs`, latest)** provides authentication. The `clerkMiddleware()` call in `middleware.ts` at the repository root gates all routes. The `auth()` helper in Server Components and Server Actions reads the current session. The `currentUser()` helper provides the full user profile including public metadata where the Slack handle is stored.

**Supabase (`@supabase/supabase-js`, latest)** is the database. Two client instances are maintained: a server-side client using the service role key (bypasses Row Level Security, used in Server Actions) and a client-side anon client (used only for real-time subscriptions if added in a future iteration). The `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.

**shadcn/ui + Tailwind CSS** provide the UI components. Dark mode uses the `class` strategy — the `dark` class on `<html>` is toggled by a theme context stored in `localStorage`. The `next-themes` package manages this toggle across server/client boundaries.

**`googleapis` (latest)** is the Google Sheets client. It uses a service account JWT for authentication. The private key is stored as a Netlify environment variable with literal `\n` characters representing newlines — the code must call `.replace(/\\n/g, '\n')` when reading the key from `process.env`.

**Atlassian Cloud REST API** is accessed directly via `fetch` in the Next.js API route. HTTP Basic Auth uses base64-encoded `email:api_token`. No SDK is required. The base URL pattern is `https://{JIRA_BASE_URL}/rest/api/3/issue/{issueKey}`.

**`@slack/web-api` (latest)** is the Slack client used in the Scheduled Function. It provides typed wrappers for `chat.postMessage` and `users.lookupByEmail`.

**`@anthropic-ai/sdk` (latest)** is the Claude client. Used in two places: the entity resolution Background Function and the intake form Server Action (for summary generation). Calls use the `claude-3-5-sonnet-20241022` model. Prompt caching via the `cache_control` parameter should be applied to the system prompt in the entity resolution function to reduce cost on repeated invocations.

**`fuse.js` (latest)** provides fuzzy string matching for the entity resolution pre-filter. It runs entirely in the Node.js function environment, with no external API calls.

**`@tanstack/react-query` v5** manages client-side data fetching and mutation state. The QueryClient is initialized in a client component provider wrapping the app layout.

**`netlify-cli` (latest)** is a dev dependency used for local function development and testing (`netlify dev`, `netlify functions:invoke`).

---

## Progress

- [x] M1 — Project Bootstrap and Deployment Pipeline (completed 2026-05-08)
- [x] M2 — Data Layer (Neon replaces Supabase) (completed 2026-05-08)
- [x] M3 — Google Sheets Import (completed 2026-05-08)
- [x] M4 — Roadmap View Read-Only (completed 2026-05-08)
- [ ] M5 — Edit and Modify Roadmap (not started)
- [ ] M6 — Tagged View My Items (not started)
- [ ] M7 — Jira Issue Enrichment (not started)
- [ ] M8 — Slack Monthly Reminders (not started)
- [ ] M9 — LLM Entity Resolution (not started)
- [ ] M10 — Initiative Intake Form (not started)
- [ ] M11 — Production Deploy and Hardening (not started)

---

## Surprises & Discoveries

**M2 (2026-05-08):** Supabase not available — replaced with Neon (serverless Postgres). Migration SQL unchanged; client library swapped from `@supabase/supabase-js` to `@neondatabase/serverless` using `Pool` for migrations and `neon()` tagged-template client for query calls. `neon.unsafe()` does not return a Promise directly — must use `Pool` + `BEGIN/COMMIT` for multi-statement migrations. Module-level `throw` on missing env vars breaks Next.js build-time static generation; refactored all clients to lazy-init functions. `/api/health` was blocked by Clerk middleware — added to `isPublicRoute` matcher. `GET /api/health` now returns `{"db":"ok"}` confirmed live against Neon.

**M1 (2026-05-08):** `create-next-app` scaffolded Next.js 16.2.6 (not 15.x as planned) — newer release, App Router works the same way; no functional impact. Tailwind v4 is used (CSS-based config in `globals.css`, no `tailwind.config.ts`); shadcn/ui v4 supports this natively. Next.js 16 renamed `middleware.ts` → `proxy.ts`; renamed accordingly. Google Fonts could not be fetched in this network environment (SSL inspection); switched layout to system fonts via CSS variables — no visual impact for an internal tool. Clerk v7 removed `afterSignOutUrl` prop from `UserButton`; removed. Turbopack fails in sandboxed environments due to process-fork restrictions; `NEXT_TURBOPACK=0` env var disables it for builds.

---

## Decision Log

**Decision: Use `@slack/web-api` instead of `@slack/bolt` for Slack integration.**
`research.md` recommended `@slack/bolt`, the full Bolt framework. However, this application only needs to send outbound messages and perform user lookups — it does not receive Slack events, respond to slash commands, or use interactive message components. The `@slack/web-api` package provides typed wrappers for the specific API methods needed (`chat.postMessage`, `users.lookupByEmail`) with significantly less boilerplate than Bolt. If interactive Slack features are added in a future iteration (e.g., a "Mark as Updated" button in the Slack reminder), Bolt can be introduced at that point.

**Decision: Use Atlassian REST API directly for Jira enrichment rather than the Atlassian Rovo MCP Server.**
`research.md` recommended the Atlassian Rovo Remote MCP Server for Jira integration. The MCP server is best suited for LLM-driven, multi-step Jira interactions (e.g., "create a ticket based on this intake form"). For this application's Jira use case — reading a single issue's title and status to populate a tooltip — a direct REST API call is simpler, has no additional dependency or hosting requirement, and stays within the 10-second synchronous function limit. If the application later needs LLM-driven Jira interactions (e.g., auto-creating tickets from intake submissions), the Rovo MCP Server integration should be added at that point.

**Decision: Sheets sync does not write back to Google Sheets.**
The plan prompt states the app should display the roadmap sourced from Google Sheets. To avoid sync conflicts and keep the data model clean, Google Sheets is treated as a one-way import source. All edits made in the UI are stored in Supabase only. The Sheet can continue to be the source of truth for the initial data set, but team members should be directed to use the UI for ongoing updates once the tool is live. This is a product decision that should be confirmed with stakeholders before Milestone 3 implementation begins.

**Decision: `canonical_initiative_id` is a self-referencing nullable foreign key on the `initiatives` table, not a separate `initiative_groups` table.**
A more normalized approach would have a separate `initiative_groups` table with initiatives pointing to it. However, for this use case (deduplication of a small number of initiatives), the self-referencing approach is simpler to query (one table, one JOIN) and easier to explain to a novice developer. If the number of aliases per initiative grows large, a groups table should be reconsidered.

**Decision (M1): Next.js 16 used instead of planned Next.js 15.**
`create-next-app` installed Next.js 16.2.6. App Router, Server Actions, and Netlify adapter all work identically. No downgrade performed.

**Decision (M1): `NEXT_TURBOPACK=0` set in build scripts to disable Turbopack.**
Turbopack forks child processes which are blocked in sandboxed/restricted environments. Webpack is used for production builds. `npm run dev` still uses Turbopack for the local dev server (fast refresh). Add `NEXT_TURBOPACK=0` to Netlify environment variables to ensure Netlify builds use Webpack.

**Decision (M2): Neon replaces Supabase as the database.**
Supabase was not accessible. Neon is serverless Postgres with an identical SQL dialect — the migration file required zero changes. Client library changed to `@neondatabase/serverless`. `lib/supabase/` renamed to `lib/db/`; `getSupabaseServer()` replaced by `getDb()`. The Neon `Pool` class is used for migration scripts; the `neon()` tagged-template function is used for application queries.

**Decision (M1): System fonts used instead of Geist (Google Fonts).**
Google Fonts CDN is unreachable in this network environment. System font stack applied via CSS variables. Can be revisited by self-hosting Geist woff2 files in `/public/fonts/` if brand consistency becomes a requirement.

---

## Outcomes & Retrospective

Not yet completed. Update this section after Milestone 11 with: what the final shipped state looks like, what deviated from the plan and why, what worked well, and what to do differently in a future iteration.
