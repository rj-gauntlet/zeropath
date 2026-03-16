# Implementation Log

## Phase 1: Foundation — 2026-03-16
- **Status:** Complete
- **Deliverables:** 11/11 complete
- **Deviations:**
  - SQLAlchemy 2.0.40 incompatible with Python 3.14 union types (`datetime | None`). Upgraded to 2.0.48 and switched to `Optional[datetime]` syntax (minor)
  - Used `--legacy-peer-deps` for npm install due to React 19 + router peer dep conflict (minor)
- **Notes:** JWT in HTTP-only cookies + CSRF double-submit cookie pattern working. Auth flow fully tested via Chrome walkthrough.

## Phase 2: Core Scanner — 2026-03-16
- **Status:** Complete
- **Deliverables:** 11/11 complete
- **Files Created:**
  - `backend/app/services/git_service.py` — shallow clone, .py extraction, size/count caps
  - `backend/app/services/llm/base.py` — abstract LLM adapter interface
  - `backend/app/services/llm/prompts.py` — security analysis system prompt + analysis prompt builder
  - `backend/app/services/llm/openai_adapter.py` — GPT-4o-mini adapter with retry logic, JSON parsing
  - `backend/app/services/scan_service.py` — scan CRUD + async scan pipeline orchestrator
  - `backend/app/services/finding_service.py` — finding CRUD, triage updates, scan comparison
  - `backend/app/utils/fingerprint.py` — code normalization + SHA-256 fingerprint generation
  - `backend/app/routers/scans.py` — POST /api/scans, GET /api/scans, GET /api/scans/{id}
  - `backend/app/routers/findings.py` — GET findings, PATCH triage, GET compare
  - `backend/app/routers/repos.py` — GET /api/repos, GET /api/repos/{id}/scans
  - `backend/app/routers/events.py` — SSE endpoint for real-time scan status
  - `frontend/src/api/endpoints.ts` — updated with scan/finding/repo API functions
  - `frontend/src/hooks/useSSE.ts` — EventSource hook for real-time updates
  - `frontend/src/components/ScanSubmitForm.tsx` — repo URL input with validation
  - `frontend/src/components/ScanStatusCard.tsx` — pulsing progress display
  - `frontend/src/components/FindingsList.tsx` — findings with severity badges, expandable details, filters
  - `frontend/src/pages/DashboardPage.tsx` — full rewrite with scan submission, SSE, findings display
- **Deviations:**
  - Fixed asyncio.as_completed bug: task-file mapping was using loop index instead of captured file_path. Fixed by returning (file_path, findings) tuple from each task (minor)
- **Test Results:**
  - End-to-end scan of pallets/flask: 78 files scanned, 5 skipped, 20 findings (19 High, 1 Medium)
  - Vulnerability types detected: Hardcoded Secrets, Improper Input Validation, SQL Injection
  - Real-time SSE progress updates confirmed working in browser
  - Finding detail expansion with code snippets and explanations verified
- **Notes:** The scan pipeline successfully handles the full flow: URL → clone → summarize → LLM analysis → fingerprint → store → SSE → display. Flask repo served as a good integration test target with real vulnerabilities found in example code.
