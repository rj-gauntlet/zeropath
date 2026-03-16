/**
 * Dashboard page — scan submission, recent scans, and scan detail views.
 *
 * Flow:
 * 1. User sees recent scans + submission form
 * 2. On submit, scan is created and SSE connection opens
 * 3. Real-time progress updates stream in
 * 4. On completion, findings are loaded and displayed
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { User, Scan, Finding } from '../types';
import { scanApi, findingApi } from '../api/endpoints';
import { useSSE } from '../hooks/useSSE';
import ScanSubmitForm from '../components/ScanSubmitForm';
import ScanStatusCard from '../components/ScanStatusCard';
import FindingsList from '../components/FindingsList';

interface DashboardPageProps {
  user: User;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [loadingScans, setLoadingScans] = useState(true);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [scanProgressDetail, setScanProgressDetail] = useState<string>('');

  // Load recent scans on mount
  useEffect(() => {
    scanApi
      .list()
      .then((data) => {
        setScans(data);
        setLoadingScans(false);
      })
      .catch(() => setLoadingScans(false));
  }, []);

  // SSE for real-time updates on active scan
  const handleSSEEvent = useCallback(
    (event: { type: string; data: Record<string, unknown> }) => {
      if (event.type === 'status') {
        setActiveScan((prev) =>
          prev ? { ...prev, status: event.data.status as Scan['status'] } : prev
        );
        setScanProgress(String(event.data.message || ''));
      }
      if (event.type === 'progress') {
        setScanProgressDetail(String(event.data.message || ''));
        // Update file counts if provided
        if (event.data.files_scanned !== undefined) {
          setActiveScan((prev) =>
            prev
              ? {
                  ...prev,
                  files_scanned: event.data.files_scanned as number,
                  files_skipped: (event.data.files_skipped as number) || prev.files_skipped,
                }
              : prev
          );
        }
      }
    },
    []
  );

  const handleSSEComplete = useCallback(() => {
    // Refresh the scan to get final state
    if (activeScan) {
      scanApi.get(activeScan.id).then((scan) => {
        setActiveScan(scan);
        setScans((prev) => prev.map((s) => (s.id === scan.id ? scan : s)));
        // Auto-load findings
        findingApi.list(scan.id).then(setFindings);
      });
    }
  }, [activeScan]);

  useSSE({
    scanId: activeScan && (activeScan.status === 'queued' || activeScan.status === 'running')
      ? activeScan.id
      : null,
    onEvent: handleSSEEvent,
    onComplete: handleSSEComplete,
  });

  // Submit a new scan
  const handleSubmit = async (repoUrl: string) => {
    const scan = await scanApi.create(repoUrl);
    setActiveScan(scan);
    setFindings([]);
    setScanProgress('Scan queued...');
    setScanProgressDetail('');
    setSelectedScanId(null);
    // Add to list
    setScans((prev) => [scan, ...prev]);
  };

  // View a past scan
  const handleViewScan = async (scanId: number) => {
    setSelectedScanId(scanId);
    setActiveScan(null);
    const scanFindings = await findingApi.list(scanId);
    setFindings(scanFindings);
  };

  // Determine which scan's findings to show
  const viewingScanId = activeScan?.id || selectedScanId;
  const viewingScan = activeScan || scans.find((s) => s.id === selectedScanId) || null;
  const showFindings =
    viewingScan && (viewingScan.status === 'complete' || viewingScan.status === 'failed');

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Scan public GitHub repositories for Python security vulnerabilities.
        </p>
      </div>

      {/* Scan submission */}
      <ScanSubmitForm
        onSubmit={handleSubmit}
        disabled={activeScan?.status === 'queued' || activeScan?.status === 'running'}
      />

      {/* Active scan progress */}
      {activeScan && (activeScan.status === 'queued' || activeScan.status === 'running') && (
        <ScanStatusCard
          scan={activeScan}
          progress={scanProgress}
          detail={scanProgressDetail}
        />
      )}

      {/* Findings display */}
      {showFindings && viewingScanId && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">
              Findings for {viewingScan?.repo_name || `Scan #${viewingScanId}`}
            </h2>
            {viewingScan && (
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span>{viewingScan.files_scanned} files scanned</span>
                {viewingScan.files_skipped > 0 && (
                  <span>{viewingScan.files_skipped} skipped</span>
                )}
              </div>
            )}
          </div>

          {viewingScan?.status === 'failed' && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">
                Scan failed: {viewingScan.error_message || 'Unknown error'}
              </p>
            </div>
          )}

          <FindingsList
            findings={findings}
            onFindingUpdated={(updated) =>
              setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
            }
          />
        </div>
      )}

      {/* Recent scans list */}
      <div className="mt-10">
        <h2 className="text-lg font-medium text-white mb-4">Recent Scans</h2>

        {loadingScans ? (
          <div className="text-gray-500 text-sm">Loading scans...</div>
        ) : scans.length === 0 ? (
          <div className="border border-gray-800 border-dashed rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">
              No scans yet. Submit a GitHub repo URL above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className={`rounded-lg border transition-colors ${
                  viewingScanId === scan.id
                    ? 'border-indigo-600 bg-indigo-900/10'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => handleViewScan(scan.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <StatusBadge status={scan.status} />
                    <span className="text-sm font-medium text-white">
                      {scan.repo_name || scan.repo_url || `Scan #${scan.id}`}
                    </span>
                  </button>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {scan.finding_count > 0 && (
                      <span className="text-amber-400">{scan.finding_count} findings</span>
                    )}
                    <span>{new Date(scan.created_at).toLocaleDateString()}</span>
                    <Link
                      to={`/scans/${scan.id}`}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      Details &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: 'bg-gray-700 text-gray-300',
    running: 'bg-blue-900/50 text-blue-400',
    complete: 'bg-green-900/50 text-green-400',
    failed: 'bg-red-900/50 text-red-400',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status] || styles.queued
      }`}
    >
      {status === 'running' && (
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse" />
      )}
      {status}
    </span>
  );
}
