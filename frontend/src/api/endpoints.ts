/**
 * Typed API functions for all endpoints.
 */

import { apiRequest } from './client';
import type {
  User,
  AuthMessageResponse,
  Scan,
  Finding,
  Repository,
  ComparisonResult,
} from '../types';

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

// Scans
export const scanApi = {
  create: (repoUrl: string) =>
    apiRequest<Scan>('/scans', {
      method: 'POST',
      body: { repo_url: repoUrl },
    }),

  list: () => apiRequest<Scan[]>('/scans'),

  get: (scanId: number) => apiRequest<Scan>(`/scans/${scanId}`),
};

// Findings
export const findingApi = {
  list: (scanId: number, filters?: { severity?: string; status?: string; vuln_type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.vuln_type) params.set('vuln_type', filters.vuln_type);
    const qs = params.toString();
    return apiRequest<Finding[]>(`/scans/${scanId}/findings${qs ? `?${qs}` : ''}`);
  },

  update: (findingId: number, data: { status?: string; triage_notes?: string }) =>
    apiRequest<Finding>(`/findings/${findingId}`, {
      method: 'PATCH',
      body: data,
    }),

  compare: (scanIdA: number, scanIdB: number) =>
    apiRequest<ComparisonResult>(`/scans/${scanIdA}/compare/${scanIdB}`),
};

// Repos
export const repoApi = {
  list: () => apiRequest<Repository[]>('/repos'),
  scans: (repoId: number) => apiRequest<Scan[]>(`/repos/${repoId}/scans`),
};
