"""Security utilities: JWT tokens, CSRF protection, password hashing.

Design decisions (interview reference):
- JWT stored in HTTP-only cookie: JavaScript cannot access the token,
  preventing XSS attacks from stealing credentials.
- CSRF double-submit cookie pattern: A CSRF token is set as a regular
  (JS-readable) cookie AND must be sent in the X-CSRF-Token header.
  The server verifies they match. This prevents CSRF attacks because
  a malicious site can't read our cookies to extract the CSRF token.
- bcrypt for password hashing: Industry standard, includes salt,
  configurable work factor.
"""

import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# CSRF token length
CSRF_TOKEN_LENGTH = 32


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int, email: str) -> str:
    """Create a JWT access token.

    The token contains:
    - sub: user ID (as string, per JWT convention)
    - email: for convenience in frontend
    - exp: expiration timestamp
    - iat: issued-at timestamp
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT access token.

    Returns the payload dict if valid, None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_hex(CSRF_TOKEN_LENGTH)
