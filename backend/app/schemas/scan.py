"""Scan request/response schemas."""

from datetime import datetime
from pydantic import BaseModel, HttpUrl


class ScanCreateRequest(BaseModel):
    repo_url: str  # Git clone URL


class ScanResponse(BaseModel):
    id: int
    repository_id: int
    status: str
    files_scanned: int
    files_skipped: int
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    repo_url: str | None = None
    repo_name: str | None = None
    finding_count: int = 0

    model_config = {"from_attributes": True}


class RepositoryResponse(BaseModel):
    id: int
    url: str
    name: str
    created_at: datetime
    scan_count: int = 0

    model_config = {"from_attributes": True}
