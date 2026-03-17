# Release — v1.0.0 (2026-03-17)

## What's New
- **ZeroPath Brand Theme** — Full light/dark mode with toggle button, localStorage persistence, and system preference detection. DM Sans + Inter typography, #2577FF accent, severity-colored end-caps on finding cards.
- **LLM Security Scanner** — Submit any public Python repo URL and get structured vulnerability findings powered by GPT-4o-mini analysis across all vulnerability classes.
- **Triage Workflow** — Mark findings as open, false positive, or resolved with notes. Filter by severity, status, and vulnerability type.
- **Cross-Scan Comparison** — Compare any two scans of the same repo to see new, fixed, and persisting vulnerabilities with fingerprint-based identity tracking.
- **Real-Time Updates** — SSE-powered scan status streaming (queued → running → complete/failed).
- **Railway CI/CD** — GitHub Actions pipeline (lint → typecheck → build → deploy) with Docker-based Railway deployment.

## Technical Details
- **Stack:** FastAPI 0.115 (Python 3.12) + React 18 (TypeScript, Vite, Tailwind CSS 4)
- **Database:** SQLite + Alembic migrations (async via aiosqlite)
- **Auth:** JWT in HTTP-only cookies + CSRF double-submit pattern
- **LLM:** OpenAI GPT-4o-mini with structured JSON output, concurrent file analysis
- **Hosting:** Railway (backend + frontend services with internal networking)
- **CI/CD:** GitHub Actions → Railway CLI deploy on push to main
- **Bundle:** 83KB JS + 6.4KB CSS (gzipped)

## Known Limitations
- Public Git repos only (no SSH/private repo auth)
- Python files only (.py) — no support for other languages yet
- SQLite database (single-writer, not suitable for high-concurrency production)
- No team/organization features (single-user per account)
- CSRF middleware returns 500 instead of 403 (protection works, status code is wrong)

## Links
- **Repository:** (GitHub repo URL)
- **Plan:** PROJECT_PLAN.md
- **Test Report:** TEST_REPORT.md (31/33 integration, 7/7 E2E, 8/8 security checks pass)
- **Review Report:** REVIEW_REPORT.md (17/17 criteria pass)
