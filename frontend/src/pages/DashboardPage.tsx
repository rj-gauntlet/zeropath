/**
 * Dashboard page — placeholder for Phase 1.
 * Will show repos, recent scans, and scan submission in Phase 2.
 */

import type { User } from '../types';

interface DashboardPageProps {
  user: User;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Welcome back, {user.email}. Ready to scan some repos.
        </p>
      </div>

      {/* Empty state — will be replaced in Phase 2 */}
      <div className="border border-gray-800 border-dashed rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-white mb-2">No scans yet</h2>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          Submit a public GitHub repository URL to scan its Python code for security vulnerabilities.
        </p>
        <div className="mt-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg text-sm text-gray-500">
            <span>Scan submission coming in Phase 2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
