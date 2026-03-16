"""Scan router: create scans, get scan details, list scans."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.scan import ScanCreateRequest, ScanResponse
from app.services.scan_service import ScanService, run_scan

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("", response_model=ScanResponse, status_code=201)
async def create_scan(
    body: ScanCreateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new scan. Kicks off async background analysis."""
    scan_service = ScanService(db)
    scan = await scan_service.create_scan(body.repo_url, user.id)
    await db.commit()

    # Spawn background task for the scan
    asyncio.create_task(run_scan(scan.id))

    # Return scan with repo info
    scan_detail = await scan_service.get_scan_with_details(scan.id, user.id)
    return scan_detail


@router.get("", response_model=list[ScanResponse])
async def list_scans(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all scans for the current user."""
    scan_service = ScanService(db)
    return await scan_service.list_scans(user.id)


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific scan."""
    scan_service = ScanService(db)
    scan_detail = await scan_service.get_scan_with_details(scan_id, user.id)
    if not scan_detail:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan_detail
