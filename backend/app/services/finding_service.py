"""Finding service: queries, triage, and cross-scan comparison."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finding import Finding


class FindingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_findings(
        self,
        scan_id: int,
        severity: str | None = None,
        status: str | None = None,
        vuln_type: str | None = None,
    ) -> list[Finding]:
        """Get findings for a scan with optional filters."""
        query = select(Finding).where(Finding.scan_id == scan_id)

        if severity:
            query = query.where(Finding.severity == severity)
        if status:
            query = query.where(Finding.status == status)
        if vuln_type:
            query = query.where(Finding.vuln_type == vuln_type)

        query = query.order_by(
            # Sort by severity: critical first
            Finding.severity.asc(),
            Finding.file_path.asc(),
            Finding.line_number.asc(),
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_finding(self, finding_id: int) -> Finding | None:
        """Get a single finding by ID."""
        result = await self.db.execute(
            select(Finding).where(Finding.id == finding_id)
        )
        return result.scalar_one_or_none()

    async def update_triage(
        self,
        finding_id: int,
        status: str | None = None,
        triage_notes: str | None = None,
    ) -> Finding | None:
        """Update a finding's triage status and/or notes."""
        finding = await self.get_finding(finding_id)
        if not finding:
            return None

        if status is not None:
            finding.status = status
        if triage_notes is not None:
            finding.triage_notes = triage_notes

        await self.db.flush()
        await self.db.refresh(finding)
        return finding

    async def compare_scans(self, scan_a_id: int, scan_b_id: int) -> dict:
        """Compare findings between two scans using fingerprints.

        Returns:
        - new: findings in scan_b not in scan_a (by fingerprint)
        - fixed: findings in scan_a not in scan_b
        - persisting: findings in both scans
        """
        result_a = await self.db.execute(
            select(Finding).where(Finding.scan_id == scan_a_id)
        )
        findings_a = list(result_a.scalars().all())

        result_b = await self.db.execute(
            select(Finding).where(Finding.scan_id == scan_b_id)
        )
        findings_b = list(result_b.scalars().all())

        fps_a = {f.fingerprint: f for f in findings_a}
        fps_b = {f.fingerprint: f for f in findings_b}

        new = [f for fp, f in fps_b.items() if fp not in fps_a]
        fixed = [f for fp, f in fps_a.items() if fp not in fps_b]
        persisting = [f for fp, f in fps_b.items() if fp in fps_a]

        return {
            "new_findings": new,
            "fixed_findings": fixed,
            "persisting_findings": persisting,
            "scan_a_id": scan_a_id,
            "scan_b_id": scan_b_id,
        }
