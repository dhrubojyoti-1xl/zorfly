import axios from 'axios';

const TOKEN_KEY = 'zorfly_access_token';

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAccessToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Silent session refresh (fixes auto-logout after the 15-min access token) ---
// On a 401 we try ONCE to mint a new access token via the httpOnly refresh
// cookie, then replay the original request. Concurrent 401s share a single
// refresh (queued) so we never fire the refresh more than once at a time.
let isRefreshing = false;
let pendingQueue = [];

function flushQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  pendingQueue = [];
}

function redirectToLogin() {
  setAccessToken('');
  if (!window.location.pathname.startsWith('/log-in')) {
    window.location.href = '/log-in';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = original.url || '';
    const isAuthCall = url.includes('/auth/');

    // Not a 401, or it's an auth endpoint (login/refresh/etc.) → don't refresh.
    if (status !== 401 || isAuthCall) {
      // A failed refresh means the session is genuinely over.
      if (status === 401 && url.includes('/auth/refresh')) redirectToLogin();
      return Promise.reject(error);
    }

    // Already retried once with a fresh token and STILL 401 → give up.
    if (original._retry) {
      redirectToLogin();
      return Promise.reject(error);
    }
    original._retry = true;

    // A refresh is already in flight — wait for it, then replay this request.
    if (isRefreshing) {
      return new Promise((resolve, reject) => pendingQueue.push({ resolve, reject })).then(() =>
        api(original)
      );
    }

    isRefreshing = true;
    try {
      const response = await api.post('/auth/refresh');
      const newToken = response.data.data.accessToken;
      setAccessToken(newToken);
      flushQueue(null, newToken);
      return api(original); // request interceptor attaches the new token
    } catch (refreshError) {
      flushQueue(refreshError, null);
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Normalises API errors into { message, errors } for the forms.
export function apiError(error) {
  const fallback = { message: 'Something went wrong. Please try again.', errors: {} };
  if (!error.response?.data) return fallback;
  return {
    message: error.response.data.message || fallback.message,
    errors: error.response.data.errors || {}
  };
}
