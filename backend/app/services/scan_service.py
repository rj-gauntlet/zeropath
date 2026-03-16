"""Scan service: CRUD operations and scanner orchestration.

The scan pipeline:
1. User submits repo URL → scan record created (status: queued)
2. asyncio background task picks it up (status: running)
3. Git service clones the repo and extracts .py files
4. LLM adapter analyzes each file for vulnerabilities
5. Findings are fingerprinted and stored
6. Scan status updated to complete (or failed on error)

SSE events are broadcast at each stage for real-time frontend updates.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.repository import Repository
from app.models.scan import Scan, ScanStatus
from app.models.finding import Finding, FindingStatus
from app.services.git_service import GitService
from app.services.llm.openai_adapter import OpenAIAdapter
from app.utils.fingerprint import generate_fingerprint
from app.config import settings

logger = logging.getLogger(__name__)

# In-memory SSE event store — maps scan_id to list of event dicts
# In production, this would use Redis pub/sub
scan_events: dict[int, list[dict]] = {}


def add_scan_event(scan_id: int, event_type: str, data: dict):
    """Add an SSE event for a scan."""
    if scan_id not in scan_events:
        scan_events[scan_id] = []
    scan_events[scan_id].append({"type": event_type, "data": data})


class ScanService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_repo(self, url: str, user_id: int) -> Repository:
        """Find an existing repo by URL and user, or create one."""
        # Normalize URL
        url = url.strip().rstrip("/")

        result = await self.db.execute(
            select(Repository).where(
                Repository.url == url,
                Repository.user_id == user_id,
            )
        )
        repo = result.scalar_one_or_none()

        if repo:
            return repo

        # Extract repo name from URL
        git_service = GitService()
        name = git_service.extract_repo_name(url)

        repo = Repository(url=url, name=name, user_id=user_id)
        self.db.add(repo)
        await self.db.flush()
        await self.db.refresh(repo)
        return repo

    async def create_scan(self, repo_url: str, user_id: int) -> Scan:
        """Create a new scan record and return it."""
        repo = await self.get_or_create_repo(repo_url, user_id)

        scan = Scan(
            repository_id=repo.id,
            user_id=user_id,
            status=ScanStatus.QUEUED.value,
        )
        self.db.add(scan)
        await self.db.flush()
        await self.db.refresh(scan)

        # Initialize SSE events
        scan_events[scan.id] = []
        add_scan_event(scan.id, "status", {
            "status": ScanStatus.QUEUED.value,
            "message": "Scan queued",
        })

        return scan

    async def get_scan(self, scan_id: int, user_id: int) -> Scan | None:
        """Get a scan by ID, ensuring it belongs to the user."""
        result = await self.db.execute(
            select(Scan).where(Scan.id == scan_id, Scan.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_scan_with_details(self, scan_id: int, user_id: int) -> dict | None:
        """Get a scan with repo info and finding count."""
        scan = await self.get_scan(scan_id, user_id)
        if not scan:
            return None

        # Get repo info
        result = await self.db.execute(
            select(Repository).where(Repository.id == scan.repository_id)
        )
        repo = result.scalar_one_or_none()

        # Get finding count
        result = await self.db.execute(
            select(func.count(Finding.id)).where(Finding.scan_id == scan_id)
        )
        finding_count = result.scalar() or 0

        return {
            "id": scan.id,
            "repository_id": scan.repository_id,
            "status": scan.status,
            "files_scanned": scan.files_scanned,
            "files_skipped": scan.files_skipped,
            "started_at": scan.started_at,
            "completed_at": scan.completed_at,
            "error_message": scan.error_message,
            "created_at": scan.created_at,
            "repo_url": repo.url if repo else None,
            "repo_name": repo.name if repo else None,
            "finding_count": finding_count,
        }

    async def list_scans(self, user_id: int) -> list[dict]:
        """List all scans for a user with repo info and finding counts."""
        result = await self.db.execute(
            select(Scan).where(Scan.user_id == user_id).order_by(Scan.created_at.desc())
        )
        scans = result.scalars().all()

        scan_list = []
        for scan in scans:
            # Get repo info
            repo_result = await self.db.execute(
                select(Repository).where(Repository.id == scan.repository_id)
            )
            repo = repo_result.scalar_one_or_none()

            # Get finding count
            count_result = await self.db.execute(
                select(func.count(Finding.id)).where(Finding.scan_id == scan.id)
            )
            finding_count = count_result.scalar() or 0

            scan_list.append({
                "id": scan.id,
                "repository_id": scan.repository_id,
                "status": scan.status,
                "files_scanned": scan.files_scanned,
                "files_skipped": scan.files_skipped,
                "started_at": scan.started_at,
                "completed_at": scan.completed_at,
                "error_message": scan.error_message,
                "created_at": scan.created_at,
                "repo_url": repo.url if repo else None,
                "repo_name": repo.name if repo else None,
                "finding_count": finding_count,
            })

        return scan_list

    async def list_scans_for_repo(self, user_id: int, repo_id: int) -> list[dict]:
        """List scans for a specific repo — filters at the DB level instead of in Python."""
        result = await self.db.execute(
            select(Scan).where(
                Scan.user_id == user_id,
                Scan.repository_id == repo_id,
            ).order_by(Scan.created_at.desc())
        )
        scans = result.scalars().all()

        scan_list = []
        for scan in scans:
            repo_result = await self.db.execute(
                select(Repository).where(Repository.id == scan.repository_id)
            )
            repo = repo_result.scalar_one_or_none()

            count_result = await self.db.execute(
                select(func.count(Finding.id)).where(Finding.scan_id == scan.id)
            )
            finding_count = count_result.scalar() or 0

            scan_list.append({
                "id": scan.id,
                "repository_id": scan.repository_id,
                "status": scan.status,
                "files_scanned": scan.files_scanned,
                "files_skipped": scan.files_skipped,
                "started_at": scan.started_at,
                "completed_at": scan.completed_at,
                "error_message": scan.error_message,
                "created_at": scan.created_at,
                "repo_url": repo.url if repo else None,
                "repo_name": repo.name if repo else None,
                "finding_count": finding_count,
            })

        return scan_list

    async def list_repos(self, user_id: int) -> list[dict]:
        """List all repos for a user with scan counts."""
        result = await self.db.execute(
            select(Repository).where(Repository.user_id == user_id).order_by(Repository.created_at.desc())
        )
        repos = result.scalars().all()

        repo_list = []
        for repo in repos:
            count_result = await self.db.execute(
                select(func.count(Scan.id)).where(Scan.repository_id == repo.id)
            )
            scan_count = count_result.scalar() or 0

            repo_list.append({
                "id": repo.id,
                "url": repo.url,
                "name": repo.name,
                "created_at": repo.created_at,
                "scan_count": scan_count,
            })

        return repo_list


async def run_scan(scan_id: int):
    """Background task: execute the full scan pipeline.

    This runs outside the request lifecycle, so it creates its own
    database session and handles all errors internally.
    """
    async with async_session() as db:
        try:
            # Load the scan
            result = await db.execute(select(Scan).where(Scan.id == scan_id))
            scan = result.scalar_one_or_none()
            if not scan:
                logger.error(f"Scan {scan_id} not found")
                return

            # Load the repo
            result = await db.execute(
                select(Repository).where(Repository.id == scan.repository_id)
            )
            repo = result.scalar_one_or_none()
            if not repo:
                logger.error(f"Repository not found for scan {scan_id}")
                return

            # Update status to running
            scan.status = ScanStatus.RUNNING.value
            scan.started_at = datetime.now(timezone.utc)
            await db.commit()

            add_scan_event(scan_id, "status", {
                "status": ScanStatus.RUNNING.value,
                "message": "Cloning repository...",
            })

            # Step 1: Clone and extract files
            git_service = GitService()
            try:
                clone_result = git_service.clone_and_extract(repo.url)
            except Exception as e:
                scan.status = ScanStatus.FAILED.value
                scan.error_message = f"Git clone failed: {str(e)}"
                scan.completed_at = datetime.now(timezone.utc)
                await db.commit()
                add_scan_event(scan_id, "status", {
                    "status": ScanStatus.FAILED.value,
                    "message": scan.error_message,
                })
                return

            if not clone_result.files:
                scan.status = ScanStatus.COMPLETE.value
                scan.files_scanned = 0
                scan.files_skipped = len(clone_result.skipped_files)
                scan.completed_at = datetime.now(timezone.utc)
                await db.commit()
                add_scan_event(scan_id, "status", {
                    "status": ScanStatus.COMPLETE.value,
                    "message": "No Python files found in repository",
                })
                return

            add_scan_event(scan_id, "progress", {
                "message": f"Found {len(clone_result.files)} Python files. Starting analysis...",
                "total_files": len(clone_result.files),
                "files_analyzed": 0,
            })

            # Step 2: Build repo summary
            repo_summary = git_service.build_repo_summary(clone_result.files)

            # Step 3: Analyze each file with LLM
            llm = OpenAIAdapter()
            all_findings = []
            files_analyzed = 0
            semaphore = asyncio.Semaphore(settings.LLM_MAX_CONCURRENCY)

            async def analyze_with_semaphore(file):
                """Analyze a single file, returning (file_path, findings)."""
                async with semaphore:
                    findings = await llm.analyze_file(
                        file.path, file.content, repo_summary
                    )
                    return file.path, findings

            # Run analyses concurrently with semaphore limiting
            tasks = [analyze_with_semaphore(f) for f in clone_result.files]

            for coro in asyncio.as_completed(tasks):
                try:
                    file_path, findings = await coro
                    files_analyzed += 1

                    for finding in findings:
                        fingerprint = generate_fingerprint(
                            file_path, finding.vuln_type, finding.code_snippet
                        )

                        db_finding = Finding(
                            scan_id=scan_id,
                            fingerprint=fingerprint,
                            severity=finding.severity,
                            vuln_type=finding.vuln_type,
                            file_path=file_path,
                            line_number=finding.line_number,
                            code_snippet=finding.code_snippet,
                            description=finding.description,
                            explanation=finding.explanation,
                            status=FindingStatus.OPEN.value,
                        )
                        db.add(db_finding)
                        all_findings.append(db_finding)

                    add_scan_event(scan_id, "progress", {
                        "message": f"Analyzed {files_analyzed}/{len(clone_result.files)} files",
                        "total_files": len(clone_result.files),
                        "files_analyzed": files_analyzed,
                        "findings_so_far": len(all_findings),
                    })

                except Exception as e:
                    logger.error(f"Error analyzing file in scan {scan_id}: {e}")
                    files_analyzed += 1

            # Step 4: Finalize
            scan.status = ScanStatus.COMPLETE.value
            scan.files_scanned = files_analyzed
            scan.files_skipped = len(clone_result.skipped_files)
            scan.completed_at = datetime.now(timezone.utc)
            await db.commit()

            add_scan_event(scan_id, "status", {
                "status": ScanStatus.COMPLETE.value,
                "message": f"Scan complete. Found {len(all_findings)} vulnerabilities in {files_analyzed} files.",
                "findings_count": len(all_findings),
            })

            # Cleanup cloned repo
            git_service.cleanup(clone_result.clone_dir)

        except Exception as e:
            logger.error(f"Unexpected error in scan {scan_id}: {e}")
            try:
                scan.status = ScanStatus.FAILED.value
                scan.error_message = f"Unexpected error: {str(e)}"
                scan.completed_at = datetime.now(timezone.utc)
                await db.commit()
                add_scan_event(scan_id, "status", {
                    "status": ScanStatus.FAILED.value,
                    "message": scan.error_message,
                })
            except Exception:
                pass
