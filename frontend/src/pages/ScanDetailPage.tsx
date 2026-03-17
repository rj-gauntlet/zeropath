/**
 * Scan detail page — shows findings for a specific scan with full triage workflow.
 * Accessible at /scans/:scanId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Scan, Finding } from '../types';
import { scanApi, findingApi } from '../api/endpoints';
import { useSSE } from '../hooks/useSSE';
import ScanStatusCard from '../components/ScanStatusCard';
import FindingsList from '../components/FindingsList';

export default function ScanDetailPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanProgress, setScanProgress] = useState('');
  const [scanProgressDetail, setScanProgressDetail] = useState('');

  const id = scanId ? parseInt(scanId, 10) : null;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      scanApi.get(id),
      findingApi.list(id).catch(() => [] as Finding[]),
    ]).then(([scanData, findingsData]) => {
      setScan(scanData);
      setFindings(findingsData);
      setLoading(false);
    }).catch(() => {
      navigate('/');
    });
  }, [id, navigate]);

  // SSE for active scans
  const handleSSEEvent = useCallback((event: { type: string; data: Record<string, unknown> }) => {
    if (event.type === 'status') {
      setScan(prev => prev ? { ...prev, status: event.data.status as Scan['status'] } : prev);
      setScanProgress(String(event.data.message || ''));
    }
    if (event.type === 'progress') {
      setScanProgressDetail(String(event.data.message || ''));
    }
  }, []);

  const handleSSEComplete = useCallback(() => {
    if (id) {
      scanApi.get(id).then(setScan);
      findingApi.list(id).then(setFindings);
    }
  }, [id]);

  useSSE({
    scanId: scan && (scan.status === 'queued' || scan.status === 'running') ? scan.id : null,
    onEvent: handleSSEEvent,
    onComplete: handleSSEComplete,
  });

  const handleFindingUpdated = (updated: Finding) => {
    setFindings(prev => prev.map(f => f.id === updated.id ? updated : f));
  };

  if (loading) {
    return <div className="text-text-faint">Loading scan...</div>;
  }

  if (!scan) {
    return <div className="text-text-faint">Scan not found.</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-faint mb-6">
        <Link to="/" className="hover:text-text-muted">Dashboard</Link>
        <span>/</span>
        <span className="text-text-muted">{scan.repo_name || `Scan #${scan.id}`}</span>
      </div>

      {/* Scan header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{scan.repo_name || `Scan #${scan.id}`}</h1>
          <p className="text-text-muted text-sm mt-1">
            {scan.repo_url} &middot; {new Date(scan.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            scan.status === 'complete' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
            scan.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400' :
            scan.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
            'bg-surface-elevated text-text-muted'
          }`}>
            {scan.status}
          </span>
          <Link
            to={`/repos/${scan.repository_id}/history`}
            className="text-sm text-accent hover:text-accent/80"
          >
            View history
          </Link>
        </div>
      </div>

      {/* Active scan progress */}
      {(scan.status === 'queued' || scan.status === 'running') && (
        <ScanStatusCard scan={scan} progress={scanProgress} detail={scanProgressDetail} />
      )}

      {/* Scan stats */}
      {scan.status === 'complete' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-text-primary">{scan.files_scanned}</div>
            <div className="text-xs text-text-faint">Files Scanned</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-text-primary">{scan.finding_count}</div>
            <div className="text-xs text-text-faint">Findings</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-text-primary">{scan.files_skipped}</div>
            <div className="text-xs text-text-faint">Files Skipped</div>
          </div>
        </div>
      )}

      {/* Error message */}
      {scan.status === 'failed' && scan.error_message && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p className="text-red-500 dark:text-red-400 text-sm">{scan.error_message}</p>
        </div>
      )}

      {/* Findings */}
      {(scan.status === 'complete' || scan.status === 'failed') && (
        <FindingsList findings={findings} onFindingUpdated={handleFindingUpdated} />
      )}
    </div>
  );
}
