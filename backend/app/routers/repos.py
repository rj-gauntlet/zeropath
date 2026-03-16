"""Repos router: list repositories and their scan history."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.scan import RepositoryResponse, ScanResponse
from app.services.scan_service import ScanService

router = APIRouter(prefix="/api/repos", tags=["repos"])


@router.get("", response_model=list[RepositoryResponse])
async def list_repos(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all repositories for the current user."""
    scan_service = ScanService(db)
    return await scan_service.list_repos(user.id)


@router.get("/{repo_id}/scans", response_model=list[ScanResponse])
async def get_repo_scans(
    repo_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get scan history for a specific repository."""
    scan_service = ScanService(db)
    return await scan_service.list_scans_for_repo(user.id, repo_id)
