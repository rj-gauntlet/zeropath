"""Authentication service: user registration, login, and token management."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import hash_password, verify_password, create_access_token


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> User | None:
        """Find a user by email address."""
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: int) -> User | None:
        """Find a user by ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create_user(self, email: str, password: str) -> User:
        """Register a new user.

        Raises ValueError if email already exists.
        """
        existing = await self.get_user_by_email(email)
        if existing:
            raise ValueError("A user with this email already exists")

        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters")

        user = User(
            email=email,
            password_hash=hash_password(password),
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def authenticate(self, email: str, password: str) -> tuple[User, str] | None:
        """Authenticate a user and return (user, access_token) or None.

        Returns None if credentials are invalid.
        """
        user = await self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None

        token = create_access_token(user.id, user.email)
        return user, token
