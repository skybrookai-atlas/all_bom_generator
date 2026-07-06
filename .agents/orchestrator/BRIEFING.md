# BRIEFING — 2026-06-30T04:36:20+10:00

## Mission
Coordinate the development team to integrate the Quotient Replica quoting tool and the quickscreen-bom-generator canvas calculator into a unified React, Vite, TS, Tailwind, and Supabase web application.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\orchestrator
- Original parent: main agent (Sentinel)
- Original parent conversation ID: 11ba6cfc-ae6d-466f-98fc-84c4093fcc9b

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\PROJECT.md
1. **Decompose**: Decompose the requirements into milestones per module boundary. Set up dual track: E2E testing track and implementation track.
2. **Dispatch & Execute**:
   - **Delegate (sub-orchestrator)**: Spawn sub-orchestrators for milestones or tracks that are too large, or run Explorer -> Worker -> Reviewer -> Challenger -> Auditor iteration loops.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Setup Project & E2E Test Suite [pending]
  2. Implement R1 Database Schema Extensions [pending]
  3. Implement R2 Unified Estimator Dashboard & Settings [pending]
  4. Implement R3 Quote Editor & Modal Canvas Calculator [pending]
  5. Implement R4 Upgraded Client Portal & Xero Integration [pending]
  6. E2E Test Verification & Hardening [pending]
- **Current phase**: 1
- **Current focus**: Decompose requirements and establish PROJECT.md and TEST_INFRA.md

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 11ba6cfc-ae6d-466f-98fc-84c4093fcc9b
- Updated: not yet

## Key Decisions Made
- Selected Project Pattern with Dual Track (Implementation + E2E Testing).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_investigate | teamwork_preview_explorer | Investigate codebase and database schema | completed | e4582803-c266-4a73-bfe7-1595d777b76d |
| worker_test_track | teamwork_preview_worker | Write E2E Cypress tests and TEST_READY.md | completed | 0a032790-1cbb-4a4b-bc30-c0487a4391c6 |
| sub_orch_impl | self | Implement database migrations, frontend UI, canvas, portal, xero, E2E | completed | 6c37dde9-cf5d-4015-acbe-ebc21dc1537a |
| auditor | teamwork_preview_auditor | Forensic audit of the codebase | failed | a3df7e01-60b4-4082-8d2c-8d9006be6a09 |
| auditor_gen2 | teamwork_preview_auditor | Forensic audit of remediated codebase | failed | 5dcfc283-6482-43d0-9400-64d332d62d09 |
| auditor_gen3 | teamwork_preview_auditor | Forensic audit of second remediation | failed | 61ce7803-aef2-4251-a75d-2d8bdc5f1ecc |
| auditor_gen4 | teamwork_preview_auditor | Forensic audit of final remediated code | failed | 48e82dbf-2117-405b-95d5-940ff8108564 |
| auditor_gen5 | teamwork_preview_auditor | Forensic audit of hardened RLS policies | completed | f60645e5-ea19-49a1-bc78-c77d281a675f |

## Succession Status
- Succession required: no
- Spawn count: 8 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: none
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\orchestrator\ORIGINAL_REQUEST.md — Original Sentinel prompt
- c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\orchestrator\BRIEFING.md — My persistent memory
