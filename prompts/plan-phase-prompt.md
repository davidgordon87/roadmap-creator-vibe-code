# Plan Phase: Create plan.md ExecPlan for Next.js Roadmap Creator

You are a coding agent in the PLAN phase. Your job is to author an ExecPlan in `plan.md` that a novice can follow to implement the roadmap creation and updating app end-to-end.

## Inputs you must use

1. `research.md` (provided in this run). Treat it as the authoritative research output and explicitly incorporate its recommendations and constraints.
1. The repository working tree you can inspect (list/read files). If a PLANS.md exists in the repo, you must read and follow it. If not, use the ExecPlan requirements described below.

## Scope can constraints (non-negotiable)
- Next.js (App Router)
- This task is PLAN ONLY: do not implement code. Produce only plan.md.

## ExecPlan requirements you must follow (format + content)
Formatting rules:
- If outputting in chat, output ONE single fenced code block labeled `md` that begins and ends with triple backticks.
- Do NOT nest additional triple-backtick fences inside that block. For commands, diffs, or snippets, use indented blocks.
- Use headings with blank lines after each heading.
- Prose-first writing. Avoid checklists/tables except where mandatory.

Mandatory living sections (must exist and be maintained during implementation later):
- Progress (checkbox list with timestamps; start with everything unchecked)
- Surprises & Discoveries
- Decision Log
- Outcomes & Retrospective

Plan quality bar:
- Define any non-obvious term immediately in plain language.
- Do not point readers to external blogs/docs. If knowledge is required, embed it in your own words.
- Anchor everything in observable behavior: what to run, what to see in the browser, what tests pass.
- Include idempotence and recovery guidance (how to rerun safely, how to recover from partial steps).

## What the plan must accomplish (user-visible behavior)
The plan must guide implementation of a user app that:
- Displays the existing roadmap sourced from Google Sheet
- Include details in each row of roadmap including relevant JIRA links
- Have ability to edit and modify roadmap within the UI
- Has a "tagged" view where a user can limit to just roadmap items where they are listed as owner
- Persists state across reloads using the persistence approach selected in `research.md`.
- Uses shadcn/ui components and Tailwind for a polished UI, including dark mode if recommended.

## Required structure
Use the "Skeleton of a Good ExecPlan" from PLANS.md style, including:
- Purpose / Big Picture
- Context and Orientation (describe repo state, key commands, what exists today)
- Plan of Work (narrative milestones; each independently verifiable)
- Concrete Steps (exact commands + expected outputs)
- Validation and Acceptance (human-verifiable behaviors + test commands)
- Idempotence and Recovery
- Interfaces and Dependencies (be prescriptive; reflect research.md decisions)

## Explicit instruction about research.md
You must explicitly reference `research.md` inside the ExecPlan:
- Summarize the chosen stack and decisions from research.md in the plan.
- If you deviate from research.md, record the deviation in Decision Log with rationale.

## Output requirements (strict)
- Output ONLY the contents of `plan.md`.
- Do not include implementation code.
- Do not include any other files besides `plan.md`.

Begin by reading `research.md` carefully, then inspecting the repository state as needed, then write `plan.md` as a complete ExecPlan.