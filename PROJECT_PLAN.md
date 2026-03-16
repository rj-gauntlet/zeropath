# ZeroPath LLM Security Scanner — Project Plan

> Generated from PRD review on 2026-03-16

## 1. Product Overview

### Vision
A web application that scans Python repositories for security vulnerabilities using LLM-powered analysis. AppSec engineers submit a Git repo URL, and the platform clones the repository, analyzes Python source files with an LLM, and presents structured findings through an authenticated dashboard with triage workflow and cross-scan comparison.

### Target Users
Application security engineers, CISOs, and software engineers at enterprises who need a centralized platform to scan Python codebases for vulnerabilities, triage findings, and track remediation over time.

### Key Outcomes
- Automated LLM-powered vulnerability detection across any vulnerability class in Python code
- Structured, actionable findings with severity, file path, line number, and AI-generated explanations
- Triage workflow enabling teams to track remediation status over time
- Cross-scan comparison showing new, fixed, and persisting vulnerabilities
- Consistent finding identity across scans so the same vulnerability isn't surfaced as new on every run

---

## 2. Requirements Summary

### Functional Requirements

| ID | Domain | Requirement | Priority |
|----|--------|-------------|----------|
| FR-01 | Auth | Login/signup with secure session management (JWT in HTTP-only cookies + CSRF protection) | Must-have |
| FR-02 | Scanning | Accept Git repo URL and clone/fetch the codebase (public repos, shallow clone, .py files only, file size/count caps) | Must-have |
| FR-03 | Scanning | LLM analyzes Python files for vulnerabilities across any vulnerability class | Must-have |
| FR-04 | Scanning | Structured findings: severity, vuln type, file path, line number, description, LLM explanation | Must-have |
| FR-05 | Status | Real-time scan status tracking via SSE: queued → running → complete → failed | Must-have |
| FR-06 | Triage | Mark findings as open / false_positive / resolved with optional notes | Must-have |
| FR-07 | History | Per-repo scan history with cross-scan comparison (new, fixed, persisting) | Must-have |
| FR-08 | Dedup | Consistent finding identity via normalized code snippet hashing | Must-have |
| FR-09 | API | REST API with clean frontend/backend separation and auto-generated Swagger docs | Must-have |
| FR-10 | Docs | Comprehensive README covering architecture, prompt design, token management, finding identity, tradeoffs, and next steps | Must-have |

### Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Security | Auth tokens stored in HTTP-only cookies, not accessible via JavaScript | XSS-resistant |
| NFR-02 | Security | CSRF protection on all state-changing endpoints | Double-submit cookie pattern |
| NFR-03 | Performance | Scan completion for average repo (50 .py files) | < 5 minutes |
| NFR-04 | Performance | File size cap to prevent runaway scans | 50KB per file, 200 files max |
| NFR-05 | UX | Real-time scan progress updates | SSE push, no polling |
| NFR-06 | DevEx | Reviewer can run the app with minimal setup | Manual install or Docker Compose |
| NFR-07 | Cost | LLM API costs predictable and bounded per scan | File caps + GPT-4o-mini pricing |

### Assumptions
- Repos to scan are public GitHub repositories (no private repo auth needed for MVP)
- A single user model is sufficient (no teams/orgs/roles)
- LLM output can be reliably parsed into structured findings with retry logic
- Reviewers have Python 3.12+ and Node.js 20+ installed (or Docker)
- OpenAI API key is provided by the user via environment variable

### Open Questions
- None — all major decisions resolved during planning session

---

## 3. Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│              React + Vite + TypeScript                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐            │
│  │  Auth    │  │ Dashboard│  │ Scan Detail│            │
│  │  Pages   │  │  + Repo  │  │ + Triage   │            │
│  │          │  │  List    │  │ + Compare  │            │
│  └──────────┘  └──────────┘  └────────────┘            │
│         │            │              │                    │
│         └────────────┴──────────────┘                    │
│                      │                                   │
│              HTTP + SSE (EventSource)                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Auth     │  │ Scan     │  │ Findings │  │  SSE   │  │
│  │ Router   │  │ Router   │  │ Router   │  │ Router │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │              │             │       │
│       ▼              ▼              ▼             ▼       │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Service Layer                        │    │
│  │  AuthService │ ScanService │ FindingService       │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     │                                     │
│       ┌─────────────┼─────────────┐                      │
│       ▼             ▼             ▼                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐               │
│  │ SQLite  │  │ Git      │  │ LLM      │               │
│  │ via     │  │ Clone    │  │ Adapter   │               │
│  │ SQLAlch.│  │ Service  │  │ (OpenAI)  │               │
│  └─────────┘  └──────────┘  └──────────┘               │
│                                                          │
│            ┌──────────────────┐                          │
│            │  asyncio Scanner │                          │
│            │  Background Task │                          │
│            └──────────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend — React + Vite + TypeScript
- **Responsibility:** Authenticated SPA with dashboard, scan submission, findings display, triage controls, and scan comparison
- **Key interfaces:** Consumes REST API via HTTP, receives scan updates via SSE (EventSource)
- **Technology:** React 19, Vite 8.0, TypeScript, Tailwind CSS v4

#### Backend — FastAPI
- **Responsibility:** REST API, authentication, scan orchestration, LLM integration, SSE streaming
- **Key interfaces:** Exposes REST endpoints, SSE stream; consumes OpenAI API, Git repos
- **Technology:** FastAPI 0.135, Python 3.12+, SQLAlchemy 2.0.48, Pydantic v2

#### Auth Router
- **Responsibility:** User signup, login, logout, current user retrieval
- **Key interfaces:** POST /api/auth/signup, /login, /logout; GET /api/auth/me
- **Technology:** python-jose (JWT), passlib + bcrypt (password hashing), HTTP-only cookies + CSRF tokens

#### Scan Router
- **Responsibility:** Create scans, retrieve scan details, list scans
- **Key interfaces:** POST /api/scans, GET /api/scans, GET /api/scans/{id}
- **Technology:** FastAPI, asyncio background tasks

#### Findings Router
- **Responsibility:** List findings for a scan, update finding triage status, compare scans
- **Key interfaces:** GET /api/scans/{id}/findings, PATCH /api/findings/{id}, GET /api/scans/{id}/compare/{other_id}
- **Technology:** FastAPI, fingerprint-based comparison

#### SSE Router
- **Responsibility:** Stream real-time scan status updates to the frontend
- **Key interfaces:** GET /api/scans/{id}/events
- **Technology:** FastAPI StreamingResponse, Server-Sent Events

#### Git Service
- **Responsibility:** Shallow clone repos, extract .py files, enforce size/count caps, report skipped files
- **Key interfaces:** Internal service consumed by Scanner
- **Technology:** GitPython

#### LLM Adapter
- **Responsibility:** Abstract interface for LLM providers; sends code + context to LLM and parses structured findings
- **Key interfaces:** Internal service with abstract base class; OpenAI implementation as default
- **Technology:** OpenAI SDK, GPT-4o-mini (configurable)

#### Scanner (Background Task)
- **Responsibility:** Orchestrates the full scan pipeline: clone → summarize → scan files → fingerprint → store findings → update status
- **Key interfaces:** Spawned by Scan Router, updates database and SSE stream
- **Technology:** Python asyncio

### Data Models

#### User
```python
class User(Base):
    __tablename__ = "users"

    id: int              # Primary key, auto-increment
    email: str           # Unique, indexed
    password_hash: str   # bcrypt hash
    created_at: datetime # UTC timestamp
```

#### Repository
```python
class Repository(Base):
    __tablename__ = "repositories"

    id: int              # Primary key, auto-increment
    url: str             # Git clone URL
    name: str            # Extracted repo name (e.g., "owner/repo")
    user_id: int         # Foreign key → User.id
    created_at: datetime # UTC timestamp
```

#### Scan
```python
class Scan(Base):
    __tablename__ = "scans"

    id: int              # Primary key, auto-increment
    repository_id: int   # Foreign key → Repository.id
    user_id: int         # Foreign key → User.id
    status: str          # Enum: "queued", "running", "complete", "failed"
    files_scanned: int   # Count of .py files analyzed
    files_skipped: int   # Count of files skipped (too large, cap reached)
    started_at: datetime # When scan began running (nullable)
    completed_at: datetime # When scan finished (nullable)
    error_message: str   # Error details if status == "failed" (nullable)
    created_at: datetime # UTC timestamp
```

#### Finding
```python
class Finding(Base):
    __tablename__ = "findings"

    id: int              # Primary key, auto-increment
    scan_id: int         # Foreign key → Scan.id
    fingerprint: str     # Hash of (file_path + vuln_type + normalized_code_snippet)
    severity: str        # Enum: "critical", "high", "medium", "low"
    vuln_type: str       # Vulnerability category (e.g., "SQL Injection", "Path Traversal")
    file_path: str       # Relative path within the repo
    line_number: int     # Line number where vulnerability starts
    code_snippet: str    # Relevant code excerpt
    description: str     # Short description of the vulnerability
    explanation: str     # LLM-generated detailed explanation
    status: str          # Enum: "open", "false_positive", "resolved"
    triage_notes: str    # User-provided notes (nullable)
    created_at: datetime # UTC timestamp
```

### API Surface

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Create a new user account | No |
| POST | `/api/auth/login` | Authenticate and set JWT cookie | No |
| POST | `/api/auth/logout` | Clear JWT cookie | Yes |
| GET | `/api/auth/me` | Get current authenticated user | Yes |
| GET | `/api/scans` | List all scans for the current user | Yes |
| POST | `/api/scans` | Submit a new scan (accepts repo URL) | Yes |
| GET | `/api/scans/{id}` | Get scan details and status | Yes |
| GET | `/api/scans/{id}/findings` | Get findings for a scan (supports filters: severity, status, vuln_type) | Yes |
| GET | `/api/scans/{id}/compare/{other_id}` | Compare two scans — returns new, fixed, and persisting findings | Yes |
| PATCH | `/api/findings/{id}` | Update finding status and/or triage notes | Yes |
| GET | `/api/repos` | List repositories for the current user | Yes |
| GET | `/api/repos/{id}/scans` | Get scan history for a specific repository | Yes |
| GET | `/api/scans/{id}/events` | SSE stream for real-time scan status updates | Yes |

### Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Frontend | React + Vite + TypeScript | Vite 8.0, React 19 | Fast dev server, type safety, required by spec |
| Styling | Tailwind CSS | v4 | Utility-first, rapid UI development |
| Backend | FastAPI + Python | FastAPI 0.135, Python 3.12+ | Async-native, auto Swagger docs, Pydantic validation |
| ORM | SQLAlchemy | 2.0.48 | Production-grade, database-agnostic (SQLite ↔ Postgres swap) |
| Database | SQLite (dev/demo) | SQLite 3 | Zero setup for reviewers, single file |
| Database (prod) | PostgreSQL | 16+ | Concurrent writes, production-grade (one-line config swap) |
| Auth | python-jose + passlib + bcrypt | Latest | JWT creation/validation + secure password hashing |
| LLM | OpenAI SDK (GPT-4o-mini) | Latest | $0.15/M input tokens, $0.60/M output tokens, 128K context |
| Git | GitPython | Latest | Programmatic clone + file extraction |
| Deployment | Docker Compose | Latest | Optional one-command setup |

### Detected Stack Constraints
Greenfield — no existing constraints. Required languages per spec: Python (backend) + JavaScript/TypeScript (frontend).

### Shared Interfaces

| Interface | Location | Purpose | Depended on by |
|-----------|----------|---------|----------------|
| Finding Pydantic schemas | `backend/app/schemas/finding.py` | Request/response types for findings across API | Scan service, Finding router, Compare logic |
| Scan status enum | `backend/app/models/scan.py` | Shared status states (queued/running/complete/failed) | Scan service, SSE router, Frontend |
| LLM adapter base class | `backend/app/services/llm/base.py` | Abstract interface for swappable LLM providers | Scanner, future model integrations |
| Fingerprint utility | `backend/app/utils/fingerprint.py` | Normalize code snippets + generate deterministic hashes | Scanner, Compare logic |
| API response types (TS) | `frontend/src/types/` | TypeScript interfaces mirroring backend Pydantic schemas | All frontend components |

---

## 4. Strategy

### Build vs. Buy

| Capability | Decision | Rationale |
|-----------|----------|-----------|
| Authentication | Build | Simple JWT flow, demonstrates security competence for a security product |
| Git operations | Library (GitPython) | Mature library, no need to shell out to git CLI |
| LLM integration | Library (OpenAI SDK) | Official SDK, well-documented, structured output support |
| UI components | Build + Tailwind | No component library needed for this scope |
| Security analysis prompts | Build | Core differentiator — must be custom and well-crafted |
| Background task processing | Built-in (asyncio) | No external infrastructure needed for demo scale |

### MVP Scope

**Included:**
- All 8 functional requirements from the spec
- Single LLM provider (GPT-4o-mini) with abstraction layer ready for swaps
- Public repos only
- SQLite with SQLAlchemy (Postgres documented as one-line swap)
- JWT auth with HTTP-only cookies + CSRF protection
- Real-time scan status via SSE
- Finding deduplication via normalized code fingerprinting
- Scan comparison (new/fixed/persisting)
- Docker Compose + manual setup instructions

**Explicitly Deferred (with rationale in README):**
- Private repo support (requires secure credential storage — PAT/OAuth)
- Multiple LLM providers selectable in the UI (abstraction layer is ready)
- Webhook/email notifications on scan completion
- Team/org features and role-based access
- Scheduled/recurring scans
- LLM-assisted finding matching across scans (enhancement to fingerprint-based dedup)
- Celery/Redis for production-grade background job processing

### Iteration Approach
Phase 1 ships full MVP. Future iterations would add private repo support, additional LLM providers, team features, and production infrastructure (Postgres, Celery, Redis). The abstraction layers built into MVP (LLM adapter, SQLAlchemy ORM) make these upgrades straightforward.

### Deployment Strategy
- **Development:** Manual install (`pip install` + `npm install` + run both) or `docker compose up`
- **Demo/Review:** Same as development — optimized for "clone and run in 2 minutes"
- **Production (documented):** Docker Compose with Postgres, Celery workers, Redis, behind a reverse proxy (nginx/Caddy). CI/CD via GitHub Actions.

---

## 5. Project Structure

```
zeropath/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app, CORS, middleware, CSRF
│   │   ├── config.py                # Settings via env vars (DB path, LLM config, JWT secret)
│   │   ├── database.py              # SQLAlchemy engine + session factory
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py              # User model
│   │   │   ├── repository.py        # Repository model
│   │   │   ├── scan.py              # Scan model + status enum
│   │   │   └── finding.py           # Finding model + severity/status enums
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # Signup/login request, user response
│   │   │   ├── scan.py              # Scan create request, scan response
│   │   │   └── finding.py           # Finding response, triage update request
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py              # /api/auth/* endpoints
│   │   │   ├── scans.py             # /api/scans/* endpoints
│   │   │   ├── findings.py          # /api/findings/* endpoints
│   │   │   ├── repos.py             # /api/repos/* endpoints
│   │   │   └── events.py            # /api/scans/{id}/events SSE endpoint
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py      # User creation, password verification, JWT logic
│   │   │   ├── scan_service.py      # Scan CRUD, trigger background scan
│   │   │   ├── finding_service.py   # Finding queries, triage updates, comparison
│   │   │   ├── git_service.py       # Shallow clone, .py extraction, file caps
│   │   │   └── llm/
│   │   │       ├── __init__.py
│   │   │       ├── base.py          # Abstract LLM adapter interface
│   │   │       ├── openai_adapter.py # OpenAI GPT-4o-mini implementation
│   │   │       └── prompts.py       # Security analysis prompt templates
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── fingerprint.py       # Code normalization + SHA-256 hashing
│   │       └── security.py          # JWT encode/decode, CSRF token, password hashing
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts            # Axios/fetch wrapper with cookie auth + CSRF
│   │   │   └── endpoints.ts         # Typed API functions (getScans, createScan, etc.)
│   │   ├── components/
│   │   │   ├── Layout.tsx           # App shell with nav
│   │   │   ├── ProtectedRoute.tsx   # Auth guard wrapper
│   │   │   ├── StatsBar.tsx         # Summary counts by severity + status
│   │   │   ├── FindingCard.tsx      # Individual finding display
│   │   │   ├── FindingFilters.tsx   # Severity/status/type filter controls
│   │   │   ├── TriagePanel.tsx      # Status change + notes input
│   │   │   ├── ScanStatusBadge.tsx  # Colored status indicator
│   │   │   └── ComparisonTable.tsx  # New/fixed/persisting findings view
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SignupPage.tsx
│   │   │   ├── DashboardPage.tsx    # Repos + recent scans overview
│   │   │   ├── ScanDetailPage.tsx   # Findings list + stats + triage
│   │   │   ├── ScanHistoryPage.tsx  # Per-repo scan history
│   │   │   └── ComparePage.tsx      # Side-by-side scan comparison
│   │   ├── hooks/
│   │   │   ├── useAuth.ts           # Auth state + login/logout/signup
│   │   │   └── useSSE.ts            # SSE connection hook for scan status
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces (User, Scan, Finding, etc.)
│   │   ├── App.tsx                  # Router + auth provider
│   │   └── main.tsx                 # Entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── README.md
├── .gitignore
└── .env.example
```

---

## 6. Implementation Plan

### Timeline
- **Start date:** 2026-03-16
- **Target completion:** 2026-03-22
- **Total estimated duration:** 7 days

### Phase 1: Foundation — Days 1-2 (Mar 16-17)

**Goal:** Backend scaffolding, database models, auth system, and frontend shell with login/signup.

**Deliverables:**
- [ ] FastAPI project setup with config, CORS, middleware
- [ ] SQLAlchemy models for User, Repository, Scan, Finding
- [ ] Database initialization with auto-create tables
- [ ] Auth system: signup, login, logout with JWT in HTTP-only cookies
- [ ] CSRF protection (double-submit cookie pattern)
- [ ] React + Vite + TypeScript project scaffolded with Tailwind CSS
- [ ] Auth pages (login/signup) wired to backend API
- [ ] Protected route wrapper component
- [ ] API client utility with cookie-based auth + CSRF token handling

**Key Tasks:**
1. Initialize FastAPI project with directory structure, config from env vars, CORS middleware
2. Define SQLAlchemy models with all fields, relationships, and enums
3. Create database.py with engine, session factory, and table auto-creation
4. Build auth service: password hashing (bcrypt), JWT creation/validation (python-jose)
5. Build auth router: POST /signup, POST /login, POST /logout, GET /me
6. Implement CSRF double-submit cookie pattern on state-changing endpoints
7. Scaffold React app: `npm create vite@latest -- --template react-ts`
8. Set up Tailwind CSS, routing (react-router-dom), and app layout
9. Build login/signup pages with form validation
10. Create API client with automatic CSRF token attachment
11. Build ProtectedRoute component and useAuth hook

**Success Criteria:**
- User can sign up, log in, and see a protected dashboard shell
- Swagger docs accessible at `/docs` with all auth endpoints
- CSRF protection verified (requests without CSRF token are rejected)
- JWT stored in HTTP-only cookie (not accessible via document.cookie in browser)

**Risks:**
- CSRF + JWT cookie interaction can be fiddly across different browsers → mitigate by testing early with browser devtools
- CORS configuration between Vite dev server and FastAPI → mitigate with proper proxy config in vite.config.ts

---

### Phase 2: Core Scanner — Days 3-4 (Mar 18-19)

**Goal:** The heart of the product — submit a repo URL, scan it with the LLM, and display structured findings.

**Deliverables:**
- [x] Git service: shallow clone, .py file extraction, size/count caps, skipped file reporting
- [x] LLM adapter abstract base class
- [x] OpenAI adapter implementation (GPT-4o-mini)
- [x] Security analysis prompt templates with structured output specification
- [x] Repo summary builder (file tree, imports graph, key function/class signatures)
- [x] Scanner orchestrator: clone → summarize → scan each file → fingerprint → store → update status
- [x] Fingerprint utility: strip comments/whitespace, normalize, SHA-256 hash
- [x] POST /api/scans endpoint with async background task trigger
- [x] GET /api/scans/{id}/events SSE endpoint
- [x] Frontend: scan submission form (repo URL input)
- [x] Frontend: scan status display with real-time SSE updates

**Key Tasks:**
1. Build git_service.py: `git clone --depth 1`, walk tree for .py files, enforce 50KB/file and 200 file caps, return file contents + skipped file list
2. Define LLM adapter base class with `analyze_file()` method signature
3. Implement OpenAI adapter: construct prompt with file content + repo context, parse structured JSON response, handle retries
4. Design security analysis prompts: system prompt defining vulnerability categories, output JSON schema, few-shot examples
5. Build repo summary: extract file list, parse imports, extract function/class signatures for context
6. Build scanner orchestrator as async function: manages full pipeline, updates scan status in DB at each stage
7. Implement fingerprint.py: normalize code (strip comments, whitespace, line numbers), hash with file_path + vuln_type
8. Wire up POST /api/scans: validate URL, create/find repository record, create scan record, spawn asyncio task
9. Implement SSE endpoint: poll scan status from DB, yield events until complete/failed
10. Build frontend scan form with URL validation
11. Build useSSE hook and scan status display component

**Success Criteria:**
- Submit a public GitHub repo URL → scan runs in background → findings appear with severity, file path, line number, description, and LLM explanation
- Scan status updates in real-time in the browser (queued → running → complete/failed)
- Skipped files are reported in scan results
- Re-scanning the same repo produces the same fingerprints for unchanged vulnerabilities
- LLM output parsing handles malformed responses gracefully (retry or skip file)

**Risks:**
- LLM output parsing: model might return unexpected JSON structure → mitigate with Pydantic validation, retry with corrective prompt, skip file on repeated failure
- Rate limiting from OpenAI API on rapid file-by-file calls → mitigate with configurable concurrency limit
- Large repos hitting file caps → surface clearly in UI which files were skipped and why

---

### Phase 3: Triage & History — Days 5-6 (Mar 20-21)

**Goal:** Make findings actionable with triage workflow, scan history, and cross-scan comparison.

**Deliverables:**
- [x] PATCH /api/findings/{id} — update status (open/false_positive/resolved) + triage notes
- [x] GET /api/repos/{id}/scans — scan history per repository
- [x] GET /api/scans/{id}/compare/{other_id} — compare findings using fingerprints (new/fixed/persisting)
- [x] GET /api/repos endpoint — list user's repositories
- [x] Frontend: findings list with summary stats bar (counts by severity + status)
- [x] Frontend: filter controls (severity, status, vulnerability type)
- [x] Frontend: triage panel (dropdown for status, textarea for notes)
- [x] Frontend: scan history view per repository
- [x] Frontend: scan comparison view (new/fixed/persisting columns)

**Key Tasks:**
1. Build finding_service.py: query findings with filters, update triage status, compare two scans by fingerprint set intersection/difference
2. Implement comparison logic: new = in scan B but not A; fixed = in A but not B; persisting = in both A and B (by fingerprint)
3. Build findings router with filter query parameters (severity, status, vuln_type)
4. Build repos router for listing repositories and their scan history
5. Build StatsBar component showing severity/status distribution
6. Build FindingCard component with expandable details
7. Build FindingFilters component with dropdowns/toggles
8. Build TriagePanel with status select + notes textarea + save button
9. Build ScanHistoryPage with timeline of scans per repo
10. Build ComparePage with three columns: new findings, fixed findings, persisting findings

**Success Criteria:**
- Can mark any finding as open/false_positive/resolved with notes, changes persist
- Dashboard shows all repos with scan counts
- Can view full scan history for any repo
- Can select two scans and see a clear comparison of what changed
- Stats bar accurately reflects current filter state
- Filters work in combination (e.g., show only "critical" + "open" findings)

**Risks:**
- Comparison logic edge cases: first scan has nothing to compare against → handle with clear "no previous scan" messaging
- Triage status and comparison interaction: if a finding is marked false_positive, should it still show as "persisting"? → yes, show it but preserve the triage status

---

### Phase 4: Polish & Ship — Day 7 (Mar 22)

**Goal:** Docker setup, README, error handling, edge cases, and final polish.

**Deliverables:**
- [ ] Dockerfile for backend (Python + uvicorn)
- [ ] Dockerfile for frontend (Node build + nginx serve)
- [ ] docker-compose.yml orchestrating both services
- [ ] .env.example with clear documentation of each variable
- [ ] Manual setup instructions tested from a fresh clone
- [ ] Comprehensive README covering all required topics
- [ ] Error handling across all API endpoints (proper HTTP status codes, error messages)
- [ ] Loading states, empty states, and error states in frontend
- [ ] Edge case handling: empty repos, repos with no .py files, LLM API errors, network failures
- [ ] UI/UX final pass: consistent spacing, responsive layout, clear visual hierarchy

**Key Tasks:**
1. Write backend Dockerfile: Python 3.12, pip install, uvicorn entrypoint
2. Write frontend Dockerfile: multi-stage build (Node build → nginx serve)
3. Write docker-compose.yml: backend + frontend services, shared .env, port mapping
4. Create .env.example with all required and optional variables documented
5. Test full setup from fresh git clone (both manual and Docker paths)
6. Write README sections: architecture overview, prompt design rationale, token/context management strategy, finding identity approach, auth security decisions (JWT cookies + CSRF), what was deferred and why, what to build next, known limitations
7. Add comprehensive error handling to all API routes
8. Add loading spinners, empty state messages, error toasts to frontend
9. Handle edge cases: no .py files found, git clone failure, LLM timeout, malformed LLM response
10. Final UI review: consistent styling, clear navigation, intuitive triage flow

**Success Criteria:**
- `git clone && docker compose up` → working app at localhost
- `git clone && pip install && npm install && run` → working app at localhost
- README is comprehensive, well-structured, and demonstrates product thinking
- Auth security rationale clearly documented for interview discussion
- No unhandled errors — all failure modes show meaningful messages
- App looks professional and polished

**Risks:**
- Time pressure on final day → mitigate by writing README notes throughout development (not all at the end)
- Docker build issues → mitigate by testing Docker setup on Day 6 if possible

---

## 7. Cost Analysis

### Development Costs

| Phase | Duration | Paid Tools / Licenses | Phase Cost |
|-------|----------|----------------------|------------|
| Phase 1: Foundation | 2 days | None | $0 |
| Phase 2: Core Scanner | 2 days | OpenAI API (testing scans) | ~$2-5 |
| Phase 3: Triage & History | 2 days | OpenAI API (additional testing) | ~$1-2 |
| Phase 4: Polish & Ship | 1 day | None | $0 |
| **Total** | **7 days** | | **~$3-7** |

*All tools and libraries are free/open-source. Development costs are essentially OpenAI API usage during testing.*

### Operational Costs at Scale

| Component | 100 users/mo | 1K users/mo | 10K users/mo | 100K users/mo |
|-----------|-------------|-------------|--------------|---------------|
| Compute (VPS/Cloud Run) | $5 | $20 | $100 | $500 |
| LLM API (GPT-4o-mini) | $3 | $30 | $300 | $3,000 |
| Database (SQLite→Postgres) | $0 | $15 | $50 | $200 |
| Storage (temp cloned repos) | $1 | $5 | $20 | $100 |
| **Monthly Total** | **$9** | **$70** | **$470** | **$3,800** |

*Assumptions: avg 3 scans/user/month, avg 50 .py files/scan, ~2K tokens input + 500 tokens output per file at GPT-4o-mini pricing ($0.15/M input, $0.60/M output).*

### Alternative Cost Comparison

#### Database

| Option | Monthly @ 1K users | Monthly @ 100K users | Notes |
|--------|-------------------|---------------------|-------|
| **SQLite** | $0 | N/A (won't scale) | Selected for MVP — zero setup |
| PostgreSQL (managed) | $15 | $200 | Production upgrade via one-line config swap |
| MySQL (managed) | $15 | $180 | Comparable to Postgres |

#### LLM Provider

| Option | Monthly @ 1K users | Monthly @ 100K users | Notes |
|--------|-------------------|---------------------|-------|
| **GPT-4o-mini** | $30 | $3,000 | Selected — best cost/performance ratio |
| GPT-4o | $150 | $15,000 | Better reasoning, 5x cost |
| Claude 3.5 Sonnet | $90 | $9,000 | Strong code analysis, 3x cost |

#### Background Processing

| Option | Monthly @ 1K users | Monthly @ 100K users | Notes |
|--------|-------------------|---------------------|-------|
| **asyncio (built-in)** | $0 | N/A (won't scale) | Selected — no extra infra |
| Celery + Redis | $10 | $50 | Production upgrade — adds durability + retries |

### Cost Summary

| Category | Low Estimate | High Estimate |
|----------|-------------|---------------|
| Total development | $3 | $7 |
| Monthly ops (@ 1K users) | $50 | $90 |
| Annual ops (@ 1K users) | $600 | $1,080 |

*Sources: [OpenAI API Pricing](https://openai.com/api/pricing/), standard cloud VPS pricing (DigitalOcean/Render/Railway), managed Postgres pricing.*

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| LLM returns malformed/unparseable output | Med | High | Pydantic validation, retry with corrective prompt, skip file after 3 failures |
| LLM hallucinates vulnerabilities (false positives) | Med | Med | Clear severity labels, triage workflow lets users mark false positives, document as known limitation |
| Large repos exceed file caps silently | Low | Med | Surface skipped files in scan results with clear explanation |
| OpenAI API rate limiting during rapid scans | Med | Low | Configurable concurrency limit, exponential backoff |
| CSRF/JWT cookie interaction breaks in certain browsers | High | Low | Test across Chrome, Firefox, Safari during Phase 1 |
| Scan takes too long for user patience | Med | Med | SSE progress updates (file X of Y), show partial results as they come in |
| Git clone fails (repo not found, network error) | Low | Med | Graceful error handling, scan status set to "failed" with descriptive message |
| 7-day timeline too tight for full polish | Med | Med | Write README notes throughout, prioritize core functionality over UI polish |

---

## 9. Next Steps

1. **Begin Phase 1** — Set up FastAPI backend with database models and auth system
2. **Set up Git repo** — Initialize with .gitignore, .env.example, and project structure
3. **Create OpenAI API key** — Ensure OPENAI_API_KEY is available for Phase 2 testing
4. **Identify test repos** — Find 2-3 public Python repos with known vulnerabilities for testing the scanner

---

## Appendix: Key Design Decisions (Interview Reference)

| Decision | Choice | Why | Alternative Considered |
|----------|--------|-----|----------------------|
| Auth token storage | HTTP-only cookies | XSS-resistant — JS can't access the token | localStorage (vulnerable to XSS) |
| CSRF protection | Double-submit cookie | Prevents cross-site request forgery without server-side state | Synchronizer token (requires server state) |
| Finding identity | Normalized code hash | Deterministic, fast, survives cosmetic code changes | LLM-assisted matching (non-deterministic, costly) |
| Real-time updates | SSE | One-way push is all we need, simpler than WebSockets | WebSocket (overkill), polling (wasteful) |
| Background processing | asyncio | Zero infra, perfect for I/O-bound LLM API calls | Celery + Redis (production upgrade path) |
| Database | SQLite + SQLAlchemy | Zero-setup demo, one-line swap to Postgres | Postgres directly (friction for reviewers) |
| Scanning strategy | File-by-file + context | Stays within token limits, catches more than naive file-by-file | Whole-repo prompt (blows context window) |
