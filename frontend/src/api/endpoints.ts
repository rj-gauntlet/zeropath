/**
 * Typed API functions for all endpoints.
 */

import { apiRequest } from './client';
import type { User, AuthMessageResponse } from '../types';

// Auth
export const authApi = {
  signup: (email: string, password: string) =>
    apiRequest<User>('/auth/signup', {
      method: 'POST',
      body: { email, password },
    }),

  login: (email: string, password: string) =>
    apiRequest<User>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  logout: () =>
    apiRequest<AuthMessageResponse>('/auth/logout', {
      method: 'POST',
    }),

  me: () => apiRequest<User>('/auth/me'),
};
