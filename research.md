# Research: Project Management Roadmap Creator — Netlify + AI Stack

## Executive Summary: Recommended Stack

1. **Framework**: Next.js 15 (App Router) deployed to Netlify via `@netlify/plugin-nextjs` — full-stack React with SSR, API routes as serverless functions, and Netlify edge caching out of the box.
2. **Authentication & access control**: Clerk — provides team/organization-level RBAC, custom roles (admin vs. contributor), user invitation flows, and pre-built React components; fastest path to per-user and per-role access without custom auth logic.
3. **Persistence**: Supabase (Postgres) for roadmap state, initiative records, and user assignments — Netlify Blobs is an option for lightweight config but lacks relational querying needed for filters and stakeholder tagging.
4. **Jira integration (tickets + Product Discovery)**: Atlassian's official Rovo Remote MCP Server — OAuth 2.1, cloud-hosted, covers both Jira Software issues and Jira Product Discovery ideas (which are standard Jira issue types queryable via the Jira Cloud REST API).
5. **Google Sheets integration**: Composio's Google Sheets MCP or the `ringo380/claude-google-sheets-mcp` open-source server — both expose Sheets read/write as structured tools callable by the LLM layer.
6. **LLM backbone**: Anthropic Claude (via `@anthropic-ai/sdk`) for intake synthesis, entity resolution across disparate project names, and initiative scoring/categorization — already in-stack, long context window suited for cross-source deduplication.
7. **Entity resolution strategy**: Hybrid pipeline — fast fuzzy string matching (`fuse.js`) to generate candidate groups, then Claude to disambiguate semantically similar but differently-named initiatives across Jira, Sheets, and other sources.
8. **Slack notifications**: Slack Bot (Bolt SDK) using `chat.scheduleMessage` for message delivery; Netlify Scheduled Functions (cron) fire monthly to create fresh schedule entries and push personalized `<@USER_ID>` mentions to project owners and admins.
9. **Long-running tasks**: Netlify Background Functions (up to 15 min execution) handle LLM aggregation, cross-source pulls, and deduplication jobs that exceed the 10-second synchronous function limit.
10. **Deployment target**: Netlify (git-connected CI/CD, per-PR deploy previews, environment variable management, scheduled + background function support, edge CDN for static assets).

---

## 1. How to Build via Netlify

### Overview of options considered

**Option A — Next.js 15 (App Router) + `@netlify/plugin-nextjs`** *(Recommended)*

Next.js 15 is the most natural fit for a data-intensive internal tool on Netlify. The official Netlify Next.js plugin handles SSR, API routes (compiled to Netlify Functions), static generation, and edge caching automatically. The App Router supports React Server Components, which reduces client-side JavaScript for filter/view pages, and supports streaming responses well-suited for LLM-backed endpoints. Deploy previews on every PR branch are included at no extra cost.

Build config is minimal: `npm run build`, publish directory `.next`, with `@netlify/plugin-nextjs` injected via `netlify.toml`. Environment variables (API tokens for Jira, Slack, Anthropic, Google) are managed in Netlify's dashboard under Site Settings → Environment.

**Option B — Remix + Netlify Remix adapter**

Remix offers excellent form handling (intake forms) and a simpler mental model for server/client data loading, but Netlify's Remix adapter is less mature than the Next.js plugin, and the ecosystem of auth providers, component libraries, and LLM tooling is more limited. Rejected in favor of Next.js.

**Option C — SvelteKit on Netlify**

Lightweight and performant but smaller ecosystem for enterprise integrations (Jira MCP SDK, Clerk, Anthropic SDK). Not recommended for a tool with heavy third-party dependencies.

### Netlify function types relevant to this tool

- **Synchronous Functions** (10s limit): UI-driven API calls — intake form submissions, filter queries, stakeholder lookups.
- **Background Functions** (15 min limit, Pro plan): LLM-based data aggregation jobs, cross-source deduplication runs, bulk Jira/Sheets pulls. Background Functions run asynchronously; the frontend polls or uses optimistic UI.
- **Scheduled Functions** (cron): Monthly Slack reminder dispatch, periodic data sync from Jira/Sheets. Free on all Netlify plans.

---

## 2. How to Password-Protect / Access-Control the Application

### Options considered

**Option A — Clerk** *(Recommended)*

Clerk provides the fastest path to the access model this tool requires: per-user authentication, organization-level membership, role-based access control (RBAC) with custom permissions, and Slack handle storage in user metadata. Key capabilities relevant here:

- Organizations map to teams or departments; a user can belong to one org with a specific role (Admin, Contributor).
- Custom roles let admins receive the monthly Slack prompt and have edit access; contributors can view/filter but not delete initiatives.
- `@clerk/nextjs` provides `auth()` middleware for App Router to gate pages and API routes server-side.
- Built-in invitation flow: admins invite users by email; no self-registration unless explicitly enabled.
- Free tier: 10,000 MAUs — appropriate for an internal team tool.

**Option B — Auth0 (via Netlify Auth0 Extension)**

Auth0 is enterprise-grade and has a native Netlify extension that streamlines tenant setup. Supports SSO, MFA, and 20+ social/enterprise providers. However, Auth0's RBAC has a known "role explosion" problem at fine-grained permission levels and requires more custom development to achieve the org-level team model Clerk provides out of the box. Setup takes longer. Appropriate if the organization already uses Auth0 for SSO.

**Option C — Netlify Identity (built-in)**

Netlify Identity is the simplest option — managed via Netlify dashboard with no external dependency. Supports JWT roles for simple gating. However, Netlify has been sunsetting some Identity features in favor of directing users to the Auth0 extension, RBAC is limited to basic role tags (not team/org scoping), and there is no built-in invitation flow or user management UI. Not recommended for a multi-user, multi-role internal tool.

**Option D — Site-wide password (Netlify Pro)**

Netlify Pro supports a single shared site password or team-member-only access. This is appropriate only as a stopgap, not a production access control model, since it offers no per-user identity or RBAC. Rejected for production use.

### Recommended approach

Use Clerk with two custom roles — `admin` and `contributor`. Admins are also enrolled as Slack reminder targets. User Slack handles are stored as Clerk user metadata (a string field in the user profile), enabling the monthly cron job to look them up without a separate user directory.

---

## 3. MCP Integrations and Authentication

### Jira (Software tickets + Product Discovery)

**Atlassian Rovo Remote MCP Server** is Atlassian's official, cloud-hosted MCP server that securely connects Jira, Confluence, and Compass to LLM agents. It supports OAuth 2.1 and API token authentication and covers both Jira Software issues and Jira Product Discovery ideas (JPD ideas are standard Jira issue types, queryable via the same Jira Cloud REST API with custom field filters).

Alternatively, the community-maintained [`sooperset/mcp-atlassian`](https://github.com/sooperset/mcp-atlassian) Python package (also on PyPI as `mcp-atlassian`) can be self-hosted and supports API token auth against both Jira Cloud and Confluence. Self-hosting adds operational overhead but avoids any Atlassian-controlled rate limiting on the Rovo tier.

**Authentication**: OAuth 2.1 PKCE for user-delegated access (reads/writes under the authenticated user's permissions); API tokens for server-to-server reads (stored as Netlify environment variables). Starting November 1, 2026, Jira Product Discovery GraphQL queries require fine-grained scoped tokens — classic API tokens will be rejected.

### Google Sheets

**Composio Google Sheets MCP** ([mcp.composio.dev/googlesheets](https://mcp.composio.dev/googlesheets)) exposes Sheets operations as structured tools — create, read, update spreadsheets — and handles OAuth credential management. The open-source alternative [`ringo380/claude-google-sheets-mcp`](https://github.com/ringo380/claude-google-sheets-mcp) is purpose-built for Claude CLI and provides the same capabilities with a self-hosted option. Both support Google OAuth 2.0.

**Authentication**: Google OAuth 2.0 service account or per-user OAuth token. For a shared internal tool reading a small set of known spreadsheets, a service account with read access to specific sheets is simpler to manage.

### Slack

The tool requires two Slack capabilities:
1. **Inbound user tagging**: Users enter their Slack handle (e.g., `@jsmith`) in their profile; the app resolves this to a Slack Member ID (`<@U12345>`) via the Slack Users API (`users.lookupByEmail` or `users.list`) for use in mentions.
2. **Outbound monthly reminders**: A Netlify Scheduled Function fires monthly, queries Clerk for all admin and project-owner users, resolves their Slack Member IDs, and calls `chat.scheduleMessage` or `chat.postMessage` directly to send personalized messages linking back to the tool.

**Slack Bolt SDK** (`@slack/bolt`) is the recommended client — it handles OAuth app installation, event subscriptions, and API calls. The app needs a Slack Bot Token (`xoxb-...`) stored as a Netlify environment variable.

**Authentication**: Slack Bot Token scopes needed: `chat:write`, `users:read`, `users:read.email`. No interactive Slack features (slash commands, modals) are required for the MVP reminder flow.

### LLM / Entity Resolution (Cross-source name normalization)

Claude (via `@anthropic-ai/sdk`) handles initiative deduplication when the same project appears under different names across Jira tickets, JPD initiatives, and Google Sheets rows. The recommended pipeline:

1. A **fuzzy pre-filter** using `fuse.js` (or a simple Levenshtein distance pass) generates candidate duplicate groups cheaply without LLM calls.
2. Uncertain candidate groups (similarity score in a configurable middle band) are sent to Claude with a structured prompt: "Are these the same initiative? If yes, which name is canonical?" 
3. Confirmed matches are cached in the database to avoid re-resolving on subsequent syncs.

This hybrid approach avoids LLM calls for obvious matches and obvious non-matches, reserving Claude for genuinely ambiguous cases — reducing both API cost and latency.

---

## 4. References and Similar Tools

### Netlify Agent Runners (Netlify, 2025–2026)

Netlify now offers [Agent Runners](https://www.netlify.com/platform/agent-runners/) — a first-party feature letting you deploy Claude Code, Gemini CLI, or Codex as infrastructure that builds and deploys apps from prompts onto real Netlify infrastructure. This is a useful reference for how Netlify expects AI-native apps to be structured and deployed: agentic backends running as Netlify Functions, with git-backed deployment and environment variable injection.

### MCP Atlassian (`sooperset/mcp-atlassian`)

[GitHub](https://github.com/sooperset/mcp-atlassian) — A well-maintained open-source MCP server for Jira and Confluence used by the Claude community. Good reference for how Atlassian auth is handled server-side and what tool shapes to expect when Jira data is exposed as MCP tools.

### Atlassian Rovo MCP Server

[GitHub](https://github.com/atlassian/atlassian-mcp-server) — Atlassian's official remote MCP server. The reference implementation for production Jira/Confluence LLM integration, demonstrating OAuth 2.1 flows and the shape of Jira issue data as tool output.

### Claude Google Sheets MCP (`ringo380/claude-google-sheets-mcp`)

[GitHub](https://github.com/ringo380/claude-google-sheets-mcp) — Claude-specific MCP server for Google Sheets, with examples of how spreadsheet row data is structured as tool results for LLM consumption. Useful for understanding data normalization before entity resolution.

### Composio MCP Ecosystem

[Composio](https://composio.dev/) — Multi-service MCP toolkit covering Jira, Google Sheets, Slack, and 100+ other tools with managed OAuth credentials. Reduces integration boilerplate but introduces a third-party dependency in the auth path. Worth evaluating if managing multiple OAuth credential sets becomes burdensome.

---

## Risk Notes

| Area | Risk | Severity | Notes |
|------|------|----------|-------|
| Jira Product Discovery API | GraphQL access requires fine-grained scoped tokens from Nov 1, 2026; classic tokens rejected | High | Plan token migration well before deadline; affects any direct JPD GraphQL queries |
| Slack `chat.scheduleMessage` | Messages can only be scheduled up to 120 days in advance | Medium | Cannot do a one-time "schedule all future reminders" setup; Netlify Scheduled Function must fire monthly to post or re-schedule |
| Netlify Background Functions | 15-minute execution cap; only available on Pro plan and above (legacy Pro plan support ending Dec 2025) | Medium | LLM aggregation jobs must fit within 15 min or be broken into smaller jobs; confirm plan tier before building on Background Functions |
| Next.js App Router + Netlify caching | Static and dynamic cache boundaries interact with Netlify's CDN edge cache; stale data can appear after updates | Medium | Use `revalidatePath` / `revalidateTag` carefully in Server Actions; test cache invalidation in deploy previews |
| Claude API rate limits | Concurrent LLM calls for entity resolution on large project lists can exhaust rate limits | Medium | Cache deduplication results in Supabase; avoid re-running resolution on already-matched pairs; use batch APIs where available |
| Google Sheets API rate limits | 100 read requests per 100 seconds per project | Low-Medium | Batch sheet reads; cache Sheets data with a reasonable TTL (e.g., 15 min) rather than pulling on every page load |
| Atlassian OAuth token refresh | OAuth 2.1 tokens expire; server-side token refresh logic must be robust | Medium | Use a library or the Atlassian SDK's token refresh handling; do not assume tokens are long-lived |
| Clerk RBAC complexity | Custom permission inheritance can become complex as roles proliferate | Low | For this tool, two roles (admin, contributor) should be sufficient — resist adding more until clearly needed |
| Slack User ID resolution | Users may enter Slack handles that don't match email-based lookups if Slack workspace uses non-standard display names | Low | Prefer `users.lookupByEmail` using the user's work email (stored in Clerk profile) over handle-based resolution |
| Netlify Identity sunset risk | Netlify has directed new users toward Auth0 extension; Identity features may be deprecated | Low | Mitigated by recommending Clerk instead of Netlify Identity |

---

## Dependency Shortlist

| Package | Justification | Version note |
|---------|---------------|--------------|
| `next` | App Router framework with SSR and API routes | 15.x |
| `@netlify/plugin-nextjs` | Netlify adapter — handles SSR, ISR, edge caching for Next.js | Latest stable |
| `@clerk/nextjs` | Auth, RBAC, org management, user metadata for Slack handles | Latest stable |
| `@anthropic-ai/sdk` | Claude API — entity resolution, intake synthesis, initiative scoring | Latest stable |
| `@slack/bolt` | Slack Bot SDK — message posting, user ID resolution | Latest stable |
| `@supabase/supabase-js` | Relational persistence for roadmap state, initiative records, stakeholder assignments | Latest stable |
| `fuse.js` | Client-side fuzzy string matching for cheap deduplication pre-filtering | Latest stable |
| `mcp-atlassian` (Python, PyPI) or Atlassian Rovo Remote MCP | Jira + Confluence + JPD MCP server | Latest stable |
| Composio Google Sheets MCP or `ringo380/claude-google-sheets-mcp` | Google Sheets read/write as LLM-callable tools | Latest stable |
| `netlify-cli` | Local development, function testing, environment variable management | Latest stable |
| `@tanstack/react-query` | Client-side data fetching, caching, and synchronization for roadmap views | v5.x |

---

*Research completed May 4, 2026. No implementation steps, file paths, or code included per research phase constraints.*
