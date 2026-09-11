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

/**
 * A file from the API, fetched with the session token rather than opened as a
 * plain link — a link cannot carry the Authorization header, and putting the
 * token in a URL would leave it in browser history and server logs.
 */
async function file(path) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${P}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('Cannot reach the server.', { code: 'offline' });
  }
  if (res.status === 401) { signedOut(); throw new ApiError('Your session has ended. Please sign in again.', { code: 'signed_out', status: 401 }); }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.message || 'The report could not be generated.', { status: res.status });
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const filename = (/filename="([^"]+)"/.exec(disposition) || [])[1] || 'report';
  return { blob: await res.blob(), filename, reportNo: res.headers.get('X-Report-No') };
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
  /* Older pages of the gate feed. `before` is the cursor the previous page
     returned — a time and an id, not an offset. */
  analytics: ({ from, to }) => call(`/analytics?from=${from}&to=${to}`),
  analyticsCompare: (params) => call(`/analytics/compare?${new URLSearchParams(params)}`),
  analyticsVisitors: ({ q = null, band = null, limit = 25, offset = 0 } = {}) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q) qs.set('q', q);
    if (band) qs.set('band', band);
    return call(`/analytics/visitors?${qs}`);
  },
  analyticsVisitor: (id) => call(`/analytics/visitor/${encodeURIComponent(id)}`),
  analyticsVehicle: (regNo) => call(`/analytics/vehicle/${encodeURIComponent(regNo)}`),
  report: (params) => call(`/reports?${new URLSearchParams(params)}`),
  reportFile: (params, format) => file(`/reports/download?${new URLSearchParams({ ...params, format })}`),
  reportHistory: () => call('/reports/history'),
  conversations: ({ q = null } = {}) => call(`/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  conversation: (id) => call(`/conversations/${encodeURIComponent(id)}`),
  liveActivity: ({ before = null, limit = 25 } = {}) =>
    call(`/live/activity?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`),
};
