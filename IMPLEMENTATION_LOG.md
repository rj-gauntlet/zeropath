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

## Phase 3: Triage & History — 2026-03-16
- **Status:** Complete
- **Deliverables:** 9/9 complete
- **Files Created/Modified:**
  - `frontend/src/components/FindingsList.tsx` — enhanced with severity/status stats bar, filter chips (severity, status, vuln type dropdown), triage panel (status select + notes textarea + save), status-colored left borders
  - `frontend/src/pages/ScanDetailPage.tsx` — new page at /scans/:scanId with breadcrumb nav, scan header, stats grid (files/findings/skipped), SSE for active scans, full findings list with triage
  - `frontend/src/pages/ScanHistoryPage.tsx` — new page at /repos/:repoId/history with scan list, checkbox A/B selection for comparison, compare button
  - `frontend/src/pages/ComparePage.tsx` — new page at /scans/:scanId/compare/:otherId with three tabbed categories (new/fixed/persisting), summary cards, color-coded finding cards
  - `frontend/src/pages/DashboardPage.tsx` — updated with "Details →" links on recent scans
  - `frontend/src/App.tsx` — added 3 new protected routes
- **Deviations:**
  - Backend API endpoints (PATCH findings, GET repos, scan history, compare) were already built in Phase 2 — Phase 3 was entirely frontend work (minor, beneficial)
- **Test Results:**
  - Triage workflow verified: changed finding status to "false_positive" with notes, persisted via API, filter chips updated in real-time (Open 18, False Positive 1)
  - Scan Detail Page: breadcrumb nav, stats grid, severity/status bars, finding list with preserved triage state all working
  - Scan History Page: renders correctly with scan rows, checkboxes for comparison selection, file/finding counts
  - Comparison Page: structure verified (requires 2 scans for full test)
  - All severity filter chips, status filter chips, and vuln type dropdown filter correctly
- **Notes:** All Phase 3 backend endpoints were already implemented during Phase 2 as part of the routers, so this phase was purely frontend. The triage panel successfully saves status changes and notes via PATCH /api/findings/{id}, with real-time UI updates reflecting the new state across all filter chips and finding cards.

## Phase 4: Polish & Ship — 2026-03-16
- **Status:** Complete
- **Deliverables:** 10/10 complete
- **Files Created:**
  - `backend/Dockerfile` — Python 3.12-slim, git installed for cloning, pip install, uvicorn entrypoint
  - `backend/.dockerignore` — excludes __pycache__, .env, .db, cloned_repos
  - `frontend/Dockerfile` — multi-stage (Node 20 build → nginx:alpine serve)
  - `frontend/nginx.conf` — SPA routing + API proxy to backend with SSE support (proxy_buffering off)
  - `frontend/.dockerignore` — excludes node_modules, dist
  - `docker-compose.yml` — backend + frontend services, shared .env, volume for SQLite persistence
  - `.env.example` — documented all required and optional environment variables
  - `README.md` — comprehensive documentation covering architecture, prompt design, token management, finding identity, auth security, API reference, deferred features, and next steps
- **Deviations:**
  - Error handling was already comprehensive from Phases 2-3 (git failures, empty repos, LLM errors, malformed JSON, per-file error isolation). No additional error handling code needed (minor, beneficial)
  - Frontend already had loading states, empty states, and error messages from Phases 2-3
- **Test Results:**
  - TypeScript: zero errors (`tsc --noEmit` passes clean)
  - Vite build: succeeds in 146ms, 268KB JS + 26KB CSS (gzipped: 82KB + 6KB)
  - Backend health check: `GET /api/health` returns 200
- **Notes:** Phase 4 was primarily about packaging (Docker) and documentation (README). The error handling and edge case coverage was already in good shape from earlier phases. README covers all required interview discussion topics: architecture, prompt design rationale, token/context management, finding identity approach, auth security decisions, deferred features, and known limitations.
