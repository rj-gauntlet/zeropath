# Build Manifest

## Project Info
- **Plan:** PROJECT_PLAN.md
- **Phases completed:** 4/4
- **Date:** 2026-03-16

## How to Run
- **Install (backend):** `cd backend && pip install -r requirements.txt`
- **Install (frontend):** `cd frontend && npm install --legacy-peer-deps`
- **Start (backend):** `cd backend && uvicorn app.main:app --reload --port 8000`
- **Start (frontend):** `cd frontend && npm run dev`
- **Docker:** `docker compose up --build`
- **Test:** TypeScript: `cd frontend && npx tsc --noEmit` | Build: `cd frontend && npm run build`

## Environment Variables Required
| Variable | Service | Required |
|----------|---------|----------|
| OPENAI_API_KEY | LLM analysis | yes |
| SECRET_KEY | JWT signing | yes (has dev default) |
| CSRF_SECRET | CSRF tokens | yes (has dev default) |
| DATABASE_URL | SQLAlchemy | no (defaults to SQLite) |
| LLM_MODEL | OpenAI model | no (defaults to gpt-4o-mini) |
| LLM_MAX_CONCURRENCY | Concurrent LLM calls | no (defaults to 5) |
| MAX_FILE_SIZE_KB | File size cap | no (defaults to 50) |
| MAX_FILES_PER_SCAN | File count cap | no (defaults to 200) |
| CORS_ORIGINS | Allowed origins | no (defaults to localhost:5173) |
| CLONED_REPOS_DIR | Temp clone dir | no (defaults to ./cloned_repos) |

## Success Criteria Status
| ID | Criteria | Status |
|----|----------|--------|
| SC-01 | LLM analyzes Python files for vulnerabilities | Met |
| SC-02 | Structured findings with severity, file, line, explanation | Met |
| SC-03 | Real-time SSE progress updates | Met |
| SC-04 | JWT auth in HTTP-only cookies + CSRF | Met |
| SC-05 | Triage workflow (open/false_positive/resolved + notes) | Met |
| SC-06 | Cross-scan comparison (new/fixed/persisting) | Met |
| SC-07 | Finding identity via fingerprinting | Met |
| SC-08 | Docker Compose deployment | Met |
| SC-09 | Comprehensive README | Met |
| SC-10 | Swagger API docs | Met |

## Known Gaps
- Private repository support (requires GitHub OAuth)
- Multi-language support (Python only)
- Refresh tokens (30-min JWT expiry, no refresh)
- Rate limiting on API endpoints
- PostgreSQL for production scaling
