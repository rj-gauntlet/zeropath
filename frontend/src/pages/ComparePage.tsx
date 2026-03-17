/**
 * Scan comparison page — shows new, fixed, and persisting findings
 * between two scans of the same repository.
 * Accessible at /scans/:scanId/compare/:otherId
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { ComparisonResult, Finding, Severity } from '../types';
import { findingApi } from '../api/endpoints';

export default function ComparePage() {
  const { scanId, otherId } = useParams<{ scanId: string; otherId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'fixed' | 'persisting'>('new');

  const idA = scanId ? parseInt(scanId, 10) : null;
  const idB = otherId ? parseInt(otherId, 10) : null;

  useEffect(() => {
    if (!idA || !idB) return;
    findingApi.compare(idA, idB).then((data) => {
      setResult(data);
      setLoading(false);
    }).catch(() => navigate('/'));
  }, [idA, idB, navigate]);

  if (loading) return <div className="text-text-faint">Loading comparison...</div>;
  if (!result) return <div className="text-text-faint">Comparison not found.</div>;

  const tabs = [
    { key: 'new' as const, label: 'New', count: result.new_findings.length, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    { key: 'fixed' as const, label: 'Fixed', count: result.fixed_findings.length, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    { key: 'persisting' as const, label: 'Persisting', count: result.persisting_findings.length, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  ];

  const activeFindings =
    activeTab === 'new' ? result.new_findings :
    activeTab === 'fixed' ? result.fixed_findings :
    result.persisting_findings;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-faint mb-6">
        <Link to="/" className="hover:text-text-muted">Dashboard</Link>
        <span>/</span>
        <span className="text-text-muted">Compare Scan #{idA} vs #{idB}</span>
      </div>

      <h1 className="text-2xl font-semibold text-text-primary mb-2">Scan Comparison</h1>
      <p className="text-text-muted text-sm mb-6">
        Comparing Scan #{idA} (baseline) with Scan #{idB} (current)
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`${tab.bg} border rounded-lg p-4 text-center transition-all ${
              activeTab === tab.key
                ? 'border-accent ring-1 ring-accent/30'
                : 'border-transparent hover:border-border-strong'
            }`}
          >
            <div className={`text-3xl font-bold ${tab.color}`}>{tab.count}</div>
            <div className="text-xs text-text-muted mt-1">{tab.label} Findings</div>
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="bg-surface/50 border border-border rounded-lg p-3 mb-6 text-sm text-text-muted">
        {activeTab === 'new' && 'These vulnerabilities appear in the newer scan but not in the baseline — they are newly introduced.'}
        {activeTab === 'fixed' && 'These vulnerabilities were present in the baseline but are absent from the newer scan — they have been fixed.'}
        {activeTab === 'persisting' && 'These vulnerabilities exist in both scans — they have not yet been addressed.'}
      </div>

      {/* Findings */}
      {activeFindings.length === 0 ? (
        <div className="border border-border border-dashed rounded-xl p-8 text-center">
          <p className="text-text-faint text-sm">
            No {activeTab} findings between these two scans.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeFindings.map((finding) => (
            <ComparisonFindingCard key={finding.id} finding={finding} category={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonFindingCard({ finding, category }: { finding: Finding; category: string }) {
  const [expanded, setExpanded] = useState(false);

  const categoryColors: Record<string, string> = {
    new: 'border-l-red-500',
    fixed: 'border-l-green-500',
    persisting: 'border-l-yellow-500',
  };

  const sevStyles: Record<Severity, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800',
    high: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-800',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-800',
    low: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-800',
  };

  return (
    <div className={`border border-border rounded-lg border-l-4 ${categoryColors[category] || ''} ${
      expanded ? 'bg-surface' : 'bg-surface/50'
    }`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-4 py-3 flex items-start gap-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize flex-shrink-0 ${sevStyles[finding.severity]}`}>
          {finding.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{finding.vuln_type}</span>
            <span className="text-xs text-text-faint">Line {finding.line_number}</span>
          </div>
          <p className="text-sm text-text-muted truncate mt-0.5">{finding.description}</p>
          <p className="text-xs text-text-faint mt-0.5 font-mono">{finding.file_path}</p>
        </div>
        <svg className={`w-4 h-4 text-text-faint transition-transform mt-1 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {finding.code_snippet && (
            <div>
              <h4 className="text-xs font-medium text-text-faint uppercase mb-1">Code</h4>
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
        </div>
      )}
    </div>
  );
}
