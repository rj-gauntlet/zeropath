"""Finding request/response schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class FindingResponse(BaseModel):
    id: int
    scan_id: int
    fingerprint: str
    severity: str
    vuln_type: str
    file_path: str
    line_number: int
    code_snippet: str
    description: str
    explanation: str
    status: str
    triage_notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FindingTriageRequest(BaseModel):
    status: Literal["open", "false_positive", "resolved"] | None = None
    triage_notes: str | None = None


class ComparisonResponse(BaseModel):
    new_findings: list[FindingResponse]
    fixed_findings: list[FindingResponse]
    persisting_findings: list[FindingResponse]
    scan_a_id: int
    scan_b_id: int
