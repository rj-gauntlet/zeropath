"""FastAPI application entry point.

Sets up:
- CORS middleware for frontend communication
- CSRF validation middleware on state-changing requests
- Database initialization on startup
- Router registration
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, scans, findings, repos, events


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    await init_db()
    yield


app = FastAPI(
    title="ZeroPath Security Scanner",
    description="LLM-powered Python security vulnerability scanner",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware — allows frontend to make requests with cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,  # Required for cookie-based auth
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """CSRF protection using double-submit cookie pattern.

    For state-changing methods (POST, PUT, PATCH, DELETE):
    1. Read the csrf_token cookie
    2. Read the X-CSRF-Token header
    3. Verify they match

    This works because:
    - A malicious site can cause the browser to SEND our cookies
    - But it CANNOT READ our cookies (same-origin policy)
    - So it can't put the CSRF token in the header
    - Only our legitimate frontend can do both

    Exceptions:
    - GET, HEAD, OPTIONS requests (safe/idempotent)
    - /api/auth/signup and /api/auth/login (no cookie exists yet)
    - /docs, /openapi.json (Swagger UI)
    """
    safe_methods = {"GET", "HEAD", "OPTIONS"}
    csrf_exempt_paths = {"/api/auth/signup", "/api/auth/login"}
    doc_paths = {"/docs", "/openapi.json", "/redoc"}

    if (
        request.method in safe_methods
        or request.url.path in csrf_exempt_paths
        or request.url.path in doc_paths
    ):
        return await call_next(request)

    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("X-CSRF-Token")

    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    return await call_next(request)


# Register routers
app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(findings.router)
app.include_router(repos.router)
app.include_router(events.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "zeropath"}
