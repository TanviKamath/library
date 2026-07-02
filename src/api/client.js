/* ============================================
   Brew & Borrow — API Client
   Centralized fetch wrapper with CSRF + cookie auth
   ============================================ */

const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = `${BASE_URL}/api/v1`;

/**
 * Read a cookie value by name.
 */
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Core fetch wrapper.
 * - Attaches credentials (cookies) on every request
 * - Attaches X-CSRF-TOKEN header on mutating requests
 * - Parses JSON responses
 * - Throws structured errors
 */
async function request(endpoint, options = {}) {
  const url = `${API_PREFIX}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    ...(options.headers || {}),
  };

  // Attach CSRF token for mutating requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCookie('csrf_access_token');
    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken;
    }
  }

  // Set Content-Type for JSON bodies (skip for FormData)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  // Handle 401 — session expired
  if (response.status === 401) {
    // If logging in, refreshing, or logging out, do not attempt to refresh
    if (['/auth/login', '/auth/refresh', '/auth/logout'].includes(endpoint)) {
      throw new ApiError('Not authenticated', 401);
    }

    // Try to refresh the token
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newCsrf = getCookie('csrf_access_token');
      if (newCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        headers['X-CSRF-TOKEN'] = newCsrf;
      }
      const retryResponse = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'include',
      });
      return handleResponse(retryResponse);
    }

    // Refresh failed — just throw error so React components can handle state cleanly without reloading
    throw new ApiError('Session expired', 401);
  }

  return handleResponse(response);
}

async function handleResponse(response) {
  // Handle no-content
  if (response.status === 204) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError('Server error', response.status);
    }
    return null;
  }

  if (!response.ok) {
    const message = data.error || data.msg || data.message || 'Request failed';
    throw new ApiError(message, response.status, data);
  }

  return data;
}

async function tryRefreshToken() {
  try {
    const csrfRefresh = getCookie('csrf_refresh_token');
    const headers = {};
    if (csrfRefresh) {
      headers['X-CSRF-TOKEN'] = csrfRefresh;
    }
    const res = await fetch(`${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Custom error class for API responses.
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/* ── Convenience methods ── */

export const api = {
  get(endpoint) {
    return request(endpoint);
  },

  post(endpoint, body) {
    return request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    return request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  },

  /**
   * Upload a file (FormData) — skips JSON content-type.
   */
  upload(endpoint, formData) {
    return request(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};

export default api;
