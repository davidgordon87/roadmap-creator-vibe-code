# Research Phase: Project Management Roadmap Creator and Updater - Frontend Only

You are a coding agent in the RESEARCH phase. Your only job is to research and recommend a path to building a Netlify app leveraging MCP connections to create a web-based app for collecting various projects from Jira Product Discovery, Jira Tickets, Google Sheets, and other sources to synthesize into a roadmap creator. In addition to creating the roadmap, you will also research ways for the tool to prompt users to update the roadmap with key questions on initiatives once per month via Slack ideally.

## Scope and constraints (non-negotiable)
The eventual app should be able to:
- Create roadmap initiatives and subtasks using intake form style questions focusing on urgency, Revenue Impact, Risk of Delayed Implementation, Business Initiative Alignment, Estimated LOE. Feel free to add in other best practice questions for scoping a project and determining impact and resource investments necessary.
- Act as both an intake form, the primary tool from which roadmaps are edited and shared, and prompt users for updates via Slack messages monthly.
- Leverage LLM and internal logic to align disparate project names from Google Sheets, Jira, etc. into one aggregate group
- Filter to specific teams, projects, owners of work
- This phase is RESEARCH ONLY: do not write code, do not propose an execution plan, do not describe file paths, routes, or implementation steps. Planning/coding happens later.

## Systems Involved
- Healthline
    - Google Sheets
        -  https://docs.google.com/spreadsheets/d/1ndTnr_gRWxjyTBkp4SGWWKDXfbjXR1bz0SUQMUhe6AI/edit?gid=820917151#gid=820917151
        - https://docs.google.com/spreadsheets/d/1WjS6RywoKSvB2S8t0xf6-ozWCs_ppgEQM0TcwlObl1M/edit?usp=sharing
    - JIRA
        - https://rvohealth.atlassian.net/jira/software/c/projects/HBA/boards/14/backlog
        - https://rvohealth.atlassian.net/jira/software/c/projects/HDE/boards/10
    - Slack
        - rvohealth.slack.com

## What "fully functioning" means (from a user POV):
- Users can add new roadmap line items to existing tools
- Users can tag relevant stakeholders, co-owners by using their Slack handles. System will alert user that they have been assigned / tagged in the tool
- Users can filter to their most relevant projects via radio buttons
- System prompts key individuals (project owners and list of tool admins [TBD]) on a monthly cadence via Slack to use tool to update roadmap where necessary

## Research Deliverables
Research and recommend options (2–3 where relevant), then choose a recommended approach with rationale:
1. How to build app via Netlify structure
1. How to password protect the application itself to only allow users with appropriate permissions to access the application
1. How to integrate various MCPs or servers requested, including individual authentication credentials
1. References to other similar tools built using AI Agents and Netlify to learn from similar projects and build using pre-existing work.

## Output Requirements
- Write everything to a single file: research.md.

- Include:
    - Executive summary (recommended stack in ~10 bullets)
    - Alternatives considered (why rejected)
    - Risk notes (rate limits, licensing, performance, App Router gotchas)
    - A dependency shortlist with short justifications (and versions if relevant)

- Do not produce `plan.md`, do not write implementation steps, do not include code.
Finish by ensuring your final output is the contents of `research.md`.