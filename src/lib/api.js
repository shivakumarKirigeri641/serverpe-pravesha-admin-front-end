/**
 * api.js — every call the admin panel makes.
 *
 * The token is the session: stored so a reload does not sign somebody out
 * mid-task, sent on every request, and cleared the moment the back-end says the
 * session has ended — once, centrally, so no screen has to handle it.
 *
 * Grows one function at a time, beside the screen that uses it.
 */

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const P = `${BASE}/admin/api`;
const KEY = 'pravesha.admin.token';

export const getToken = () => { try { return localStorage.getItem(KEY) || null; } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

const listeners = new Set();
export const onSignedOut = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const signedOut = () => { setToken(null); listeners.forEach((fn) => fn()); };

export class ApiError extends Error {
  constructor(message, { code = 'error', status = 0, body = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.body = body;
    this.offline = code === 'offline';
  }
}

async function call(path, { method = 'GET', body, auth = true, timeoutMs = 20000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${P}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new ApiError(
      e.name === 'TimeoutError' ? 'The server is taking too long to answer.' : 'Cannot reach the server.',
      { code: 'offline' });
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && auth) {
    signedOut();
    throw new ApiError(data.message || 'Your session has ended. Please sign in again.', { code: 'signed_out', status: 401 });
  }
  if (!res.ok) {
    throw new ApiError(data.message || 'Something went wrong.', { code: data.error || 'error', status: res.status, body: data });
  }
  return data;
}

export const api = {
  signIn: (mobile, password) =>
    call('/session', { method: 'POST', auth: false, body: { mobile, password } })
      .catch((e) => {
        /* A wrong password and a locked account are answers the screen shows,
           not failures it has to apologise for. */
        if (e.body && (e.code === 'bad_credentials' || e.code === 'locked')) return e.body;
        throw e;
      }),
  session: () => call('/session'),
  signOut: () => call('/session', { method: 'DELETE' }),
  dashboard: (date) => call(`/dashboard${date ? `?date=${date}` : ''}`),
  /* Polled every few seconds by the live screen, so it fails fast rather than
     leaving a watcher staring at a frozen page. */
  live: () => call('/live', { timeoutMs: 12000 }),
};
