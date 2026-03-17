/**
 * App shell with navigation header and theme toggle.
 */

import { Link, useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { useTheme } from '../hooks/useTheme';
import ZeroPathLogo from './ZeroPathLogo';

interface LayoutProps {
  user: User | null;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-body text-text-primary">
      {/* Navigation */}
      <nav className="border-b border-border bg-nav-bg/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <ZeroPathLogo width={18} height={21} />
              <span className="font-semibold text-base text-text-primary tracking-wide uppercase" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em' }}>
                ZeroPath
              </span>
            </Link>

            {/* User actions */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                {theme === 'dark' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>

              {user && (
                <>
                  <span className="text-sm text-text-muted">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-text-muted hover:text-text-primary border border-border hover:border-border-strong transition-colors px-3 py-1.5 rounded-md"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
