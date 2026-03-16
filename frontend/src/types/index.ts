/**
 * TypeScript interfaces mirroring backend Pydantic schemas.
 * Single source of truth for data shapes across the frontend.
 */

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Repository {
  id: number;
  url: string;
  name: string;
  created_at: string;
  scan_count: number;
}

export type ScanStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface Scan {
  id: number;
  repository_id: number;
  status: ScanStatus;
  files_scanned: number;
  files_skipped: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  repo_url?: string;
  repo_name?: string;
  finding_count: number;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingStatus = 'open' | 'false_positive' | 'resolved';

export interface Finding {
  id: number;
  scan_id: number;
  fingerprint: string;
  severity: Severity;
  vuln_type: string;
  file_path: string;
  line_number: number;
  code_snippet: string;
  description: string;
  explanation: string;
  status: FindingStatus;
  triage_notes: string | null;
  created_at: string;
}

export interface ComparisonResult {
  new_findings: Finding[];
  fixed_findings: Finding[];
  persisting_findings: Finding[];
  scan_a_id: number;
  scan_b_id: number;
}

export interface AuthMessageResponse {
  message: string;
}
