/**
 * Findings display — shows security findings with severity badges,
 * code snippets, and expandable details.
 */

import { useState } from 'react';
import type { Finding, Severity } from '../types';

interface FindingsListProps {
  findings: Finding[];
}

export default function FindingsList({ findings }: FindingsListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Severity | 'all'>('all');

  if (findings.length === 0) {
    return (
      <div className="border border-gray-800 border-dashed rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-white font-medium mb-1">No vulnerabilities found</h3>
        <p className="text-gray-500 text-sm">This scan completed with a clean bill of health.</p>
      </div>
    );
  }

  // Count by severity
  const counts = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const filtered = filter === 'all' ? findings : findings.filter((f) => f.severity === filter);

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-sm text-gray-400">{findings.length} total findings:</span>
        <FilterChip
          label="All"
          count={findings.length}
          active={filter === 'all'}
          color="gray"
          onClick={() => setFilter('all')}
        />
        {(['critical', 'high', 'medium', 'low'] as const).map(
          (sev) =>
            counts[sev] && (
              <FilterChip
                key={sev}
                label={sev}
                count={counts[sev]}
                active={filter === sev}
                color={severityColor(sev)}
                onClick={() => setFilter(sev)}
              />
            )
        )}
      </div>

      {/* Findings list */}
      <div className="space-y-3">
        {filtered.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            expanded={expandedId === finding.id}
            onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FindingCard({
  finding,
  expanded,
  onToggle,
}: {
  finding: Finding;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border rounded-lg transition-colors ${
        expanded ? 'border-gray-600 bg-gray-900' : 'border-gray-800 bg-gray-900/50'
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{finding.vuln_type}</span>
            <span className="text-xs text-gray-500">Line {finding.line_number}</span>
          </div>
          <p className="text-sm text-gray-400 truncate mt-0.5">{finding.description}</p>
          <p className="text-xs text-gray-600 mt-0.5 font-mono">{finding.file_path}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform mt-1 flex-shrink-0 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {/* Code snippet */}
          {finding.code_snippet && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Vulnerable Code</h4>
              <pre className="bg-gray-950 border border-gray-800 rounded p-3 text-xs text-gray-300 overflow-x-auto font-mono">
                {finding.code_snippet}
              </pre>
            </div>
          )}

          {/* Explanation */}
          {finding.explanation && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Explanation</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{finding.explanation}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-600 pt-1">
            <span>Fingerprint: {finding.fingerprint.slice(0, 12)}...</span>
            <span>Status: {finding.status}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: 'bg-red-900/50 text-red-400 border-red-800',
    high: 'bg-orange-900/50 text-orange-400 border-orange-800',
    medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    low: 'bg-blue-900/50 text-blue-400 border-blue-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize flex-shrink-0 ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

function FilterChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
        active
          ? `bg-${color}-900/50 text-${color}-300 ring-1 ring-${color}-700`
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}

function severityColor(severity: Severity): string {
  const map: Record<Severity, string> = {
    critical: 'red',
    high: 'orange',
    medium: 'yellow',
    low: 'blue',
  };
  return map[severity];
}
