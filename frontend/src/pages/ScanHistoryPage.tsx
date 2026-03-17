/**
 * Scan history page — shows all scans for a specific repository.
 * Allows selecting two scans to compare.
 * Accessible at /repos/:repoId/history
 */

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Scan } from '../types';
import { repoApi } from '../api/endpoints';

export default function ScanHistoryPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  const id = repoId ? parseInt(repoId, 10) : null;

  useEffect(() => {
    if (!id) return;
    repoApi.scans(id).then((data) => {
      setScans(data);
      setLoading(false);
    }).catch(() => navigate('/'));
  }, [id, navigate]);

  const repoName = scans[0]?.repo_name || `Repository #${repoId}`;

  const handleCompare = () => {
    if (compareA && compareB) {
      navigate(`/scans/${compareA}/compare/${compareB}`);
    }
  };

  const toggleCompare = (scanId: number) => {
    if (compareA === scanId) { setCompareA(null); return; }
    if (compareB === scanId) { setCompareB(null); return; }
    if (!compareA) { setCompareA(scanId); return; }
    if (!compareB) { setCompareB(scanId); return; }
    // Both set, replace B
    setCompareB(scanId);
  };

  if (loading) return <div className="text-text-faint">Loading scan history...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-faint mb-6">
        <Link to="/" className="hover:text-text-muted">Dashboard</Link>
        <span>/</span>
        <span className="text-text-muted">{repoName} — Scan History</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{repoName}</h1>
          <p className="text-text-muted text-sm mt-1">{scans.length} scans total</p>
        </div>

        {/* Compare action */}
        {(compareA || compareB) && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">
              {compareA && compareB
                ? `Compare Scan #${compareA} vs #${compareB}`
                : 'Select another scan to compare'}
            </span>
            <button
              onClick={handleCompare}
              disabled={!compareA || !compareB}
              className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:bg-surface-elevated disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Compare
            </button>
            <button
              onClick={() => { setCompareA(null); setCompareB(null); }}
              className="text-sm text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {scans.length === 0 ? (
        <div className="border border-border border-dashed rounded-xl p-8 text-center">
          <p className="text-text-faint text-sm">No scans yet for this repository.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const isSelectedA = compareA === scan.id;
            const isSelectedB = compareB === scan.id;
            const isSelected = isSelectedA || isSelectedB;

            return (
              <div
                key={scan.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface/50 hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleCompare(scan.id)}
                      className={`w-5 h-5 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
                        isSelected
                          ? 'border-accent bg-accent text-white'
                          : 'border-border-strong text-text-faint hover:border-text-muted'
                      }`}
                      title="Select for comparison"
                    >
                      {isSelectedA ? 'A' : isSelectedB ? 'B' : ''}
                    </button>

                    <Link to={`/scans/${scan.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        scan.status === 'complete' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
                        scan.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400' :
                        scan.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                        'bg-surface-elevated text-text-muted'
                      }`}>
                        {scan.status}
                      </span>
                      <span className="text-sm text-text-primary font-medium">
                        Scan #{scan.id}
                      </span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-text-faint">
                    <span>{scan.files_scanned} files</span>
                    {scan.finding_count > 0 && (
                      <span className="text-amber-500 dark:text-amber-400">{scan.finding_count} findings</span>
                    )}
                    <span>{new Date(scan.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
