/**
 * Auth state management hook.
 *
 * Provides user state, login/signup/logout functions,
 * and loading state for auth operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/endpoints';
import type { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const user = await authApi.login(email, password);
      setUser(user);
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const user = await authApi.signup(email, password);
      setUser(user);
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await authApi.logout();
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      throw err;
    }
  }, []);

  return { user, loading, error, login, signup, logout, setError };
}
