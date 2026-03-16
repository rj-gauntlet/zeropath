/**
 * API client with cookie-based auth and CSRF token handling.
 *
 * CSRF strategy:
 * - On login/signup, the server sets a csrf_token cookie (JS-readable)
 * - On every state-changing request (POST/PUT/PATCH/DELETE),
 *   we read the cookie and send it as the X-CSRF-Token header
 * - The server verifies cookie value === header value
 */

const API_BASE = '/api';

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Attach CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      requestHeaders['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include', // Send cookies with every request
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
