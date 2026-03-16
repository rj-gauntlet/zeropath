"""Auth router: signup, login, logout, current user.

Security design:
- JWT is set as an HTTP-only cookie (not accessible via JS → XSS resistant)
- CSRF token is set as a regular cookie (JS-readable) and must be sent
  back in the X-CSRF-Token header on state-changing requests
- SameSite=Lax provides baseline CSRF protection; the CSRF token adds defense-in-depth
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import SignupRequest, LoginRequest, UserResponse, AuthMessageResponse
from app.services.auth_service import AuthService
from app.utils.security import generate_csrf_token, decode_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Cookie settings
COOKIE_NAME = "access_token"
CSRF_COOKIE_NAME = "csrf_token"
COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours in seconds


def set_auth_cookies(response: Response, token: str):
    """Set JWT and CSRF cookies on the response."""
    # JWT: HTTP-only, secure in production, SameSite=Lax
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    # CSRF token: JS-readable (not HTTP-only), used for double-submit pattern
    csrf_token = generate_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,  # Must be readable by JavaScript
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


def clear_auth_cookies(response: Response):
    """Clear JWT and CSRF cookies."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Dependency: extract and validate the current user from JWT cookie.

    Raises 401 if not authenticated.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = int(payload["sub"])
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@router.post("/signup", response_model=UserResponse, status_code=201)
async def signup(body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Create a new user account and set auth cookies."""
    auth_service = AuthService(db)
    try:
        user = await auth_service.create_user(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token = create_access_token_for_user(user)
    set_auth_cookies(response, token)
    return user


@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate and set auth cookies."""
    auth_service = AuthService(db)
    result = await auth_service.authenticate(body.email, body.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user, token = result
    set_auth_cookies(response, token)
    return user


@router.post("/logout", response_model=AuthMessageResponse)
async def logout(response: Response, _user=Depends(get_current_user)):
    """Clear auth cookies (requires authentication)."""
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    """Get the currently authenticated user."""
    return user


# Helper to avoid circular import
def create_access_token_for_user(user):
    from app.utils.security import create_access_token
    return create_access_token(user.id, user.email)
