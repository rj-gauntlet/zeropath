/**
 * Findings display — shows security findings with severity badges,
 * code snippets, expandable details, triage controls, and filters.
 *
 * Phase 3 additions:
 * - Status filter (open/false_positive/resolved)
 * - Vulnerability type filter
 * - Triage panel (status dropdown + notes textarea)
 * - Stats bar with severity + status distribution
 */

import { useState } from 'react';
import type { Finding, Severity, FindingStatus } from '../types';
import { findingApi } from '../api/endpoints';

interface FindingsListProps {
  findings: Finding[];
  onFindingUpdated?: (updated: Finding) => void;
}

export default function FindingsList({ findings, onFindingUpdated }: FindingsListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FindingStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  if (findings.length === 0) {
    return (
      <div className="border border-border border-dashed rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-text-primary font-medium mb-1">No vulnerabilities found</h3>
        <p className="text-text-faint text-sm">This scan completed with a clean bill of health.</p>
      </div>
    );
  }

  // Counts
  const sevCounts = findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {} as Record<string, number>);
  const statusCounts = findings.reduce((acc, f) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const vulnTypes = [...new Set(findings.map((f) => f.vuln_type))].sort();

  // Apply filters
  let filtered = findings;
  if (severityFilter !== 'all') filtered = filtered.filter((f) => f.severity === severityFilter);
  if (statusFilter !== 'all') filtered = filtered.filter((f) => f.status === statusFilter);
  if (typeFilter !== 'all') filtered = filtered.filter((f) => f.vuln_type === typeFilter);

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Critical" count={sevCounts['critical'] || 0} color="text-red-500 dark:text-red-400" bg="bg-red-50 dark:bg-red-900/20" border="border-l-sev-critical" />
        <StatCard label="High" count={sevCounts['high'] || 0} color="text-orange-500 dark:text-orange-400" bg="bg-orange-50 dark:bg-orange-900/20" border="border-l-sev-high" />
        <StatCard label="Medium" count={sevCounts['medium'] || 0} color="text-yellow-600 dark:text-yellow-400" bg="bg-yellow-50 dark:bg-yellow-900/20" border="border-l-sev-medium" />
        <StatCard label="Low" count={sevCounts['low'] || 0} color="text-blue-500 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" border="border-l-sev-low" />
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Severity filter chips */}
        <span className="text-xs text-text-faint uppercase font-medium">Severity:</span>
        <FilterChip label="All" count={findings.length} active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} />
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) =>
          sevCounts[sev] ? (
            <FilterChip key={sev} label={sev} count={sevCounts[sev]} active={severityFilter === sev} onClick={() => setSeverityFilter(sev)} />
          ) : null
        )}

        <span className="text-border-strong">|</span>

        {/* Status filter chips */}
        <span className="text-xs text-text-faint uppercase font-medium">Status:</span>
        <FilterChip label="All" count={findings.length} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        {(['open', 'false_positive', 'resolved'] as const).map((st) =>
          statusCounts[st] ? (
            <FilterChip key={st} label={st.replace('_', ' ')} count={statusCounts[st]} active={statusFilter === st} onClick={() => setStatusFilter(st)} />
          ) : null
        )}

        {/* Vuln type dropdown */}
        {vulnTypes.length > 1 && (
          <>
            <span className="text-border-strong">|</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface-elevated border border-border-strong text-text-muted text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-accent"
            >
              <option value="all">All types</option>
              {vulnTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="text-xs text-text-faint mb-3">{filtered.length} of {findings.length} findings shown</div>

      {/* Findings list */}
      <div className="space-y-3">
        {filtered.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            expanded={expandedId === finding.id}
            onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
            onUpdated={onFindingUpdated}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, count, color, bg, border }: { label: string; count: number; color: string; bg: string; border: string }) {
  return (
    <div className={`${bg} rounded-lg p-3 text-center border-l-4 ${border} overflow-hidden relative`}>
      <div className={`text-xl font-bold ${color}`}>{count}</div>
      <div className="text-xs text-text-faint">{label}</div>
    </div>
  );
}

function FindingCard({
  finding,
  expanded,
  onToggle,
  onUpdated,
}: {
  finding: Finding;
  expanded: boolean;
  onToggle: () => void;
  onUpdated?: (updated: Finding) => void;
}) {
  const [triageStatus, setTriageStatus] = useState<FindingStatus>(finding.status);
  const [triageNotes, setTriageNotes] = useState(finding.triage_notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveTriage = async () => {
    setSaving(true);
    try {
      const updated = await findingApi.update(finding.id, {
        status: triageStatus,
        triage_notes: triageNotes || undefined,
      });
      onUpdated?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail — the UI still shows current state
    } finally {
      setSaving(false);
    }
  };

  const sevBorder: Record<Severity, string> = {
    critical: 'border-l-sev-critical',
    high: 'border-l-sev-high',
    medium: 'border-l-sev-medium',
    low: 'border-l-sev-low',
  };

  const statusBorder: Record<string, string> = {
    false_positive: 'border-l-gray-500',
    resolved: 'border-l-green-500',
  };

  const leftBorder = finding.status === 'open'
    ? sevBorder[finding.severity] || ''
    : statusBorder[finding.status] || '';

  return (
    <div
      className={`border rounded-lg transition-colors border-l-4 ${leftBorder} ${
        expanded ? 'border-border-strong bg-surface' : 'border-border bg-surface/50'
      }`}
    >
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-start gap-3">
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{finding.vuln_type}</span>
            <span className="text-xs text-text-faint">Line {finding.line_number}</span>
            <FindingStatusBadge status={finding.status} />
          </div>
          <p className="text-sm text-text-muted truncate mt-0.5">{finding.description}</p>
          <p className="text-xs text-text-faint mt-0.5 font-mono">{finding.file_path}</p>
        </div>
        <svg
          className={`w-4 h-4 text-text-faint transition-transform mt-1 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {finding.code_snippet && (
            <div>
              <h4 className="text-xs font-medium text-text-faint uppercase mb-1">Vulnerable Code</h4>
              <pre className="bg-code-bg border border-border rounded p-3 text-xs text-text-muted overflow-x-auto font-mono">
                {finding.code_snippet}
              </pre>
            </div>
          )}

          {finding.explanation && (
            <div>
              <h4 className="text-xs font-medium text-text-faint uppercase mb-1">Explanation</h4>
              <p className="text-sm text-text-muted leading-relaxed">{finding.explanation}</p>
            </div>
          )}

          {/* Triage panel */}
          <div className="bg-code-bg border border-border rounded-lg p-4 mt-2">
            <h4 className="text-xs font-medium text-text-faint uppercase mb-3">Triage</h4>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <label className="text-xs text-text-faint block mb-1">Status</label>
                <select
                  value={triageStatus}
                  onChange={(e) => setTriageStatus(e.target.value as FindingStatus)}
                  className="bg-input-bg border border-border-strong text-text-muted text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent"
                >
                  <option value="open">Open</option>
                  <option value="false_positive">False Positive</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-text-faint block mb-1">Notes</label>
                <textarea
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  placeholder="Add triage notes..."
                  rows={2}
                  className="w-full bg-input-bg border border-border-strong text-text-muted text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex-shrink-0 pt-5">
                <button
                  onClick={handleSaveTriage}
                  disabled={saving}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    saved
                      ? 'bg-green-500/15 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                      : 'bg-accent hover:bg-accent/90 text-white disabled:opacity-50'
                  }`}
                >
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-faint pt-1">
            <span>Fingerprint: {finding.fingerprint.slice(0, 12)}...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const styles: Record<FindingStatus, string> = {
    open: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    false_positive: 'bg-gray-200 text-gray-700 dark:bg-surface-elevated dark:text-text-muted',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: 'bg-red-600 text-white border-red-700 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800',
    high: 'bg-orange-500 text-white border-orange-600 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-800',
    medium: 'bg-yellow-500 text-white border-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-800',
    low: 'bg-blue-500 text-white border-blue-600 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize flex-shrink-0 ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
        active ? 'bg-accent/10 text-accent ring-1 ring-accent/40' : 'bg-surface-elevated text-text-muted hover:bg-border-strong/20'
      }`}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}
