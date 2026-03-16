"""Findings router: list findings, triage, compare scans."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.finding import FindingResponse, FindingTriageRequest, ComparisonResponse
from app.services.finding_service import FindingService
from app.services.scan_service import ScanService

router = APIRouter(tags=["findings"])


@router.get("/api/scans/{scan_id}/findings", response_model=list[FindingResponse])
async def get_findings(
    scan_id: int,
    severity: str | None = Query(None),
    status: str | None = Query(None),
    vuln_type: str | None = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get findings for a scan with optional filters."""
    # Verify scan belongs to user
    scan_service = ScanService(db)
    scan = await scan_service.get_scan(scan_id, user.id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    finding_service = FindingService(db)
    return await finding_service.get_findings(scan_id, severity, status, vuln_type)


@router.patch("/api/findings/{finding_id}", response_model=FindingResponse)
async def update_finding(
    finding_id: int,
    body: FindingTriageRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a finding's triage status and/or notes."""
    finding_service = FindingService(db)
    finding = await finding_service.get_finding(finding_id)

    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    # Verify the finding's scan belongs to the user
    scan_service = ScanService(db)
    scan = await scan_service.get_scan(finding.scan_id, user.id)
    if not scan:
        raise HTTPException(status_code=404, detail="Finding not found")

    updated = await finding_service.update_triage(
        finding_id, body.status, body.triage_notes
    )
    return updated


@router.get("/api/scans/{scan_id}/compare/{other_id}", response_model=ComparisonResponse)
async def compare_scans(
    scan_id: int,
    other_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare findings between two scans (new/fixed/persisting)."""
    scan_service = ScanService(db)

    scan_a = await scan_service.get_scan(scan_id, user.id)
    if not scan_a:
        raise HTTPException(status_code=404, detail="First scan not found")

    scan_b = await scan_service.get_scan(other_id, user.id)
    if not scan_b:
        raise HTTPException(status_code=404, detail="Second scan not found")

    finding_service = FindingService(db)
    return await finding_service.compare_scans(scan_id, other_id)
