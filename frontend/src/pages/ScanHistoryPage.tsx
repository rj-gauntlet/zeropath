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

  if (loading) return <div className="text-gray-500">Loading scan history...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-gray-300">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-300">{repoName} — Scan History</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">{repoName}</h1>
          <p className="text-gray-400 text-sm mt-1">{scans.length} scans total</p>
        </div>

        {/* Compare action */}
        {(compareA || compareB) && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {compareA && compareB
                ? `Compare Scan #${compareA} vs #${compareB}`
                : 'Select another scan to compare'}
            </span>
            <button
              onClick={handleCompare}
              disabled={!compareA || !compareB}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Compare
            </button>
            <button
              onClick={() => { setCompareA(null); setCompareB(null); }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {scans.length === 0 ? (
        <div className="border border-gray-800 border-dashed rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No scans yet for this repository.</p>
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
                    ? 'border-indigo-600 bg-indigo-900/10'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleCompare(scan.id)}
                      className={`w-5 h-5 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-gray-600 text-gray-600 hover:border-gray-400'
                      }`}
                      title="Select for comparison"
                    >
                      {isSelectedA ? 'A' : isSelectedB ? 'B' : ''}
                    </button>

                    <Link to={`/scans/${scan.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        scan.status === 'complete' ? 'bg-green-900/50 text-green-400' :
                        scan.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                        scan.status === 'running' ? 'bg-blue-900/50 text-blue-400' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {scan.status}
                      </span>
                      <span className="text-sm text-white font-medium">
                        Scan #{scan.id}
                      </span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <span>{scan.files_scanned} files</span>
                    {scan.finding_count > 0 && (
                      <span className="text-amber-400">{scan.finding_count} findings</span>
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
