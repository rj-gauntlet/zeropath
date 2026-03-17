/**
 * Scan submission form — enter a GitHub repo URL to start a scan.
 */

import { useState } from 'react';

interface ScanSubmitFormProps {
  onSubmit: (repoUrl: string) => Promise<void>;
  disabled?: boolean;
}

export default function ScanSubmitForm({ onSubmit, disabled }: ScanSubmitFormProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = repoUrl.trim();
    if (!trimmed) return;

    // Basic GitHub URL validation
    if (!trimmed.match(/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setRepoUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            disabled={disabled || submitting}
            className="w-full px-4 py-3 bg-input-bg border border-border-strong rounded-lg text-text-primary placeholder-text-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || submitting || !repoUrl.trim()}
          className="px-6 py-3 bg-accent hover:bg-accent/90 disabled:bg-surface-elevated disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting...
            </span>
          ) : disabled ? (
            'Scan in progress...'
          ) : (
            'Scan Repository'
          )}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}
