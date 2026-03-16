/**
 * Real-time scan progress display.
 * Shows a pulsing status card while scan is running.
 */

import type { Scan } from '../types';

interface ScanStatusCardProps {
  scan: Scan;
  progress: string;
  detail: string;
}

export default function ScanStatusCard({ scan, progress, detail }: ScanStatusCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6">
      <div className="flex items-center gap-3 mb-3">
        {/* Pulsing indicator */}
        <div className="relative">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <div className="w-3 h-3 bg-blue-500 rounded-full absolute top-0 animate-ping" />
        </div>
        <h3 className="text-white font-medium">
          Scanning {scan.repo_name || 'repository'}...
        </h3>
      </div>

      {/* Progress message */}
      <p className="text-sm text-gray-300 ml-6">{progress}</p>
      {detail && <p className="text-xs text-gray-500 ml-6 mt-1">{detail}</p>}

      {/* File counts */}
      {scan.files_scanned > 0 && (
        <div className="mt-3 ml-6 flex gap-4 text-xs text-gray-500">
          <span>{scan.files_scanned} files analyzed</span>
          {scan.files_skipped > 0 && <span>{scan.files_skipped} skipped</span>}
        </div>
      )}
    </div>
  );
}
