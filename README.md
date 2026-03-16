# ZeroPath — LLM-Powered Python Security Scanner

A web application that scans Python repositories for security vulnerabilities using LLM-powered analysis. Submit a GitHub repo URL, and ZeroPath clones the repository, analyzes Python source files with GPT-4o-mini, and presents structured findings through an authenticated dashboard with triage workflow and cross-scan comparison.

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- An [OpenAI API key](https://platform.openai.com/api-keys)
- Git

### Manual Setup

```bash
# Clone the project
git clone <repo-url> && cd zeropath

# Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:5173** — sign up, paste a GitHub URL, and start scanning.

### Docker Setup

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
docker compose up --build
```

Open **http://localhost** — the frontend proxies API requests to the backend automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Dashboard │  │Scan      │  │History   │  │Comparison  │  │
│  │  Page    │  │Detail    │  │  Page    │  │   Page     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │              │             │              │          │
│       └──────────────┴─────────────┴──────────────┘          │
│                         │ REST + SSE                         │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                  FastAPI Backend                             │
│  ┌──────────┐  ┌────────┴──────┐  ┌──────────────────────┐  │
│  │Auth      │  │Scan Pipeline  │  │Finding Service       │  │
│  │(JWT/CSRF)│  │  ┌──────────┐ │  │  - Query + filter    │  │
│  └──────────┘  │  │Git Clone │ │  │  - Triage (status,   │  │
│                │  ├──────────┤ │  │    notes)             │  │
│                │  │File      │ │  │  - Compare scans     │  │
│                │  │Extract   │ │  │    (fingerprints)     │  │
│                │  ├──────────┤ │  └──────────────────────┘  │
│                │  │LLM       │ │                            │
│                │  │Analysis  │ │  ┌──────────────────────┐  │
│                │  ├──────────┤ │  │SSE Event Stream      │  │
│                │  │Fingerprint│ │  │  - Progress updates  │  │
│                │  │+ Store   │ │  │  - Status changes     │  │
│                │  └──────────┘ │  └──────────────────────┘  │
│                └───────────────┘                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SQLite (via SQLAlchemy async)            │   │
│  │  users │ repositories │ scans │ findings              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Fast dev cycle, type safety, utility-first styling |
| Backend | FastAPI + Python 3.12 | Async-native, auto-generated OpenAPI docs, Pydantic validation |
| Database | SQLite + SQLAlchemy 2.0 (async) | Zero config, portable, sufficient for take-home scope |
| LLM | OpenAI GPT-4o-mini | Best cost/quality ratio for code analysis (128K context window, ~$0.15/1M input tokens) |
| Auth | JWT in HTTP-only cookies + CSRF double-submit | XSS-resistant token storage, CSRF protection |
| Real-time | Server-Sent Events (SSE) | Simpler than WebSockets for unidirectional server→client updates |

---

## Prompt Design

### Philosophy

The security analysis prompt prioritizes **precision over recall** — it's better to miss a finding than to hallucinate one. False positives erode user trust and waste triage time.

### System Prompt Structure

The system prompt (`backend/app/services/llm/prompts.py`) defines:

1. **Role**: Expert application security engineer specializing in Python
2. **Scope**: 15 vulnerability categories (SQL injection, command injection, XSS, SSRF, path traversal, insecure deserialization, hardcoded secrets, weak crypto, auth flaws, insecure file ops, XXE, race conditions, info disclosure, input validation, insecure dependencies)
3. **Anti-patterns**: Explicit instructions to NOT flag code style issues, performance problems, or theoretical vulnerabilities
4. **Output schema**: Strict JSON array with severity, vuln_type, line_number, code_snippet, description, explanation
5. **Severity guidelines**: Concrete definitions — critical (direct RCE/auth bypass), high (exploitable with conditions), medium (requires significant conditions), low (informational)

### Per-File Analysis Prompt

Each file is analyzed with:
- **Repository context summary**: File tree, import patterns, and framework detection — gives the LLM cross-file awareness without sending the entire codebase
- **File content**: The full Python source
- **Response format enforcement**: `response_format={"type": "json_object"}` + explicit JSON schema in prompt

### Why Not a Single Giant Prompt?

Sending all files in one prompt would hit context limits and degrade quality. File-by-file analysis with repo summary provides the best balance: each file gets focused attention while maintaining cross-file context awareness.

---

## Token & Context Window Management

### Strategy

GPT-4o-mini has a 128K token context window. Our approach:

1. **File size cap (50KB)**: Files larger than 50KB are skipped. Most Python source files are well under this limit; files exceeding it are typically auto-generated or data files.

2. **File count cap (200)**: Maximum 200 .py files per scan. This bounds total API cost and scan time while covering the vast majority of repositories.

3. **Concurrency control**: `asyncio.Semaphore(5)` limits concurrent LLM API calls. This prevents rate limiting while maximizing throughput.

4. **Per-file prompts**: Each API call sends ~2K tokens (system prompt) + file content + repo summary. For a typical 200-line Python file (~3K tokens), total input is ~6K tokens per call — well within the 128K limit.

5. **Low temperature (0.1)**: Reduces variance in analysis, making results more deterministic and consistent across runs.

### Cost Estimation

With GPT-4o-mini at $0.15/1M input tokens and $0.60/1M output tokens:
- Average file: ~6K input tokens, ~500 output tokens
- 50-file repo: ~300K input tokens ($0.045) + ~25K output tokens ($0.015) = **~$0.06 per scan**
- 200-file repo (max): ~$0.24 per scan

---

## Finding Identity & Deduplication

### The Problem

When the same repository is scanned twice, the LLM may produce slightly different descriptions or line numbers for the same vulnerability (due to minor code changes, whitespace, or LLM non-determinism). Without deduplication, every scan shows all findings as "new."

### Solution: Fingerprinting

Each finding is assigned a **fingerprint** — a SHA-256 hash of:

```
file_path + ":" + vuln_type + ":" + normalize(code_snippet)
```

**Normalization** (`backend/app/utils/fingerprint.py`):
- Strips single-line comments (`# ...`)
- Removes leading/trailing whitespace per line
- Collapses consecutive whitespace
- Removes blank lines

This makes fingerprints resilient to cosmetic changes while still detecting meaningful code modifications.

### Cross-Scan Comparison

When comparing Scan A (baseline) and Scan B (current):
- **New findings**: fingerprint in B but not in A
- **Fixed findings**: fingerprint in A but not in B
- **Persisting findings**: fingerprint in both A and B

This is a simple set operation on fingerprint strings — efficient and deterministic.

### Tradeoffs

- **File renames break identity**: If a file is renamed, its findings get new fingerprints. Mitigated by including vuln_type and code_snippet in the hash — if the same vulnerable code exists in the renamed file, the vuln_type + code match may still produce the same fingerprint.
- **Code refactoring creates new fingerprints**: Significant code changes (even if the same vulnerability class) produce new fingerprints. This is intentional — if the code changed significantly, the finding should be re-evaluated.
- **LLM snippet variability**: The LLM might extract slightly different code snippets across runs. Normalization helps, but isn't perfect. A future improvement would be to use AST-based fingerprinting.

---

## Authentication & Security

### JWT in HTTP-Only Cookies

**Why cookies instead of localStorage?**

Tokens stored in localStorage are accessible to any JavaScript running on the page — a single XSS vulnerability exposes the token. HTTP-only cookies are inaccessible to JavaScript, eliminating this attack vector.

**Implementation:**
- Token issued on login/signup, set via `Set-Cookie` with `httponly=True`, `samesite=Lax`, `secure=True` (in production)
- Frontend never sees or handles the token — the browser sends it automatically
- 30-minute expiry with no refresh token (acceptable for take-home scope)

### CSRF Protection

HTTP-only cookies introduce a CSRF risk — the browser sends the cookie automatically on cross-origin requests. We mitigate this with the **double-submit cookie pattern**:

1. On login, backend sets a second cookie (`csrf_token`) that IS readable by JavaScript (`httponly=False`)
2. Frontend reads this cookie and sends it as an `X-CSRF-Token` header on state-changing requests
3. Backend verifies the header value matches the cookie value
4. An attacker can't read the cookie from a different origin (same-origin policy), so they can't construct the header

### Password Security

- Passwords hashed with bcrypt (cost factor 12)
- Minimum 8 characters enforced at API level
- No plaintext passwords stored or logged

---

## API Reference

Full interactive API docs available at **http://localhost:8000/docs** (Swagger UI) when the backend is running.

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Sign in (sets JWT cookie) |
| POST | `/api/auth/logout` | Sign out (clears cookie) |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/scans` | Submit new scan |
| GET | `/api/scans` | List user's scans |
| GET | `/api/scans/{id}` | Get scan details |
| GET | `/api/scans/{id}/events` | SSE stream for scan progress |
| GET | `/api/scans/{id}/findings` | Get findings (supports `?severity=&status=&vuln_type=` filters) |
| PATCH | `/api/findings/{id}` | Update triage status + notes |
| GET | `/api/scans/{id}/compare/{other_id}` | Compare two scans |
| GET | `/api/repos` | List user's repositories |
| GET | `/api/repos/{id}/scans` | Scan history for a repository |

---

## What Was Deferred

These features were considered but explicitly deferred to stay within scope:

| Feature | Why Deferred | Complexity |
|---------|-------------|------------|
| Private repo support | Requires GitHub OAuth + token management | Medium |
| Multi-language support | Would need language-specific prompts and file parsers | High |
| Webhook/CI integration | Requires GitHub App setup and webhook infrastructure | High |
| Refresh tokens | JWT refresh flow adds complexity; 30-min expiry is sufficient for demo | Low |
| User management | Multi-user org features, roles, permissions | Medium |
| Finding auto-grouping | Clustering similar findings across files | Medium |
| AST-based fingerprinting | More robust than text hashing but requires language-specific parsers | Medium |
| Rate limiting | API rate limiting per user | Low |
| Email notifications | Scan completion alerts | Low |

---

## What to Build Next

If this were a production product, the highest-impact next steps would be:

1. **Private repo support via GitHub OAuth** — most enterprise repos are private. This is the single biggest unlock for real-world usage.

2. **AST-based fingerprinting** — replace text normalization with Python AST parsing for more robust finding identity across code refactors.

3. **Scheduled scans** — scan repos on a schedule (daily/weekly) to catch newly introduced vulnerabilities. Combined with the existing comparison feature, this enables trend tracking.

4. **PostgreSQL migration** — SQLite works for single-instance deployment, but PostgreSQL enables concurrent writes, better query performance, and horizontal scaling.

5. **SARIF export** — output findings in SARIF format for integration with GitHub Advanced Security, VS Code, and other security tooling.

---

## Known Limitations

- **Public repos only**: No authentication for private repositories
- **Python only**: Only `.py` files are analyzed
- **LLM accuracy varies**: GPT-4o-mini may miss subtle vulnerabilities or occasionally flag non-issues
- **No incremental scanning**: Each scan re-analyzes all files (comparison handles the diff at the findings level)
- **Single-instance deployment**: In-memory SSE event store doesn't work across multiple backend instances
- **SQLite limitations**: No concurrent write support, not suitable for high-traffic production use

---

## Project Structure

```
zeropath/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, router registration
│   │   ├── config.py            # Environment-based configuration
│   │   ├── database.py          # SQLAlchemy async engine + session
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── repository.py
│   │   │   ├── scan.py
│   │   │   └── finding.py
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── scan.py
│   │   │   └── finding.py
│   │   ├── routers/             # API route handlers
│   │   │   ├── auth.py
│   │   │   ├── scans.py
│   │   │   ├── findings.py
│   │   │   ├── repos.py
│   │   │   └── events.py
│   │   ├── services/            # Business logic
│   │   │   ├── scan_service.py  # Scan CRUD + pipeline orchestration
│   │   │   ├── finding_service.py
│   │   │   ├── git_service.py   # Repo cloning + file extraction
│   │   │   └── llm/
│   │   │       ├── base.py      # Abstract LLM adapter interface
│   │   │       ├── prompts.py   # Security analysis prompts
│   │   │       └── openai_adapter.py
│   │   └── utils/
│   │       ├── security.py      # JWT + CSRF utilities
│   │       └── fingerprint.py   # Finding deduplication
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root with routing
│   │   ├── api/
│   │   │   ├── client.ts        # Axios instance with CSRF
│   │   │   └── endpoints.ts     # Typed API functions
│   │   ├── hooks/
│   │   │   ├── useAuth.ts       # Auth state management
│   │   │   └── useSSE.ts        # EventSource hook
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── ScanSubmitForm.tsx
│   │   │   ├── ScanStatusCard.tsx
│   │   │   └── FindingsList.tsx  # Stats, filters, triage panel
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       ├── SignupPage.tsx
│   │       ├── DashboardPage.tsx
│   │       ├── ScanDetailPage.tsx
│   │       ├── ScanHistoryPage.tsx
│   │       └── ComparePage.tsx
│   ├── package.json
│   ├── nginx.conf               # Production proxy config
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
