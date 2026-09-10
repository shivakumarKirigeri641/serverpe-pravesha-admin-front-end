/**
 * The single door to the back-end.
 *
 * Every request carries the bearer token; every 401 clears the session and
 * bounces to the login screen, so an expired session can never leave the panel
 * showing data it is no longer entitled to display.
 *
 * The token lives in sessionStorage rather than localStorage: closing the tab
 * ends the session. This panel shows citizens' mobile numbers, vehicle numbers
 * and a government department's revenue — it should not survive a closed
 * browser on a shared office machine.
 */

const KEY = 'serverpe.entry.admin.token';

// Empty in development, where Vite proxies /admin/api to port 7777. Set at
// build time for production, where the panel and the API are different hosts.
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => sessionStorage.setItem(KEY, t);
export const clearToken = () => sessionStorage.removeItem(KEY);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

let onToast = () => {};
export const setToastHandler = (fn) => { onToast = fn; };

async function request(path, { method = 'GET', body, signal, quiet = false } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}/admin/api${path}`, {
      method, headers, signal, body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const msg = 'Cannot reach the server. Please check that the back-end is running.';
    if (!quiet) onToast({ type: 'error', message: msg });
    throw new Error(msg);
  }

  if (res.status === 401) {
    clearToken();
    onUnauthorized();
    throw new Error('Your session has ended. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    const msg = data.message || data.error || `Request failed (${res.status})`;
    if (!quiet) onToast({ type: 'error', message: msg });
    const e = new Error(msg);
    e.data = data;
    throw e;
  }

  if (method !== 'GET' && !quiet) onToast({ type: 'ok', message: 'Saved.' });
  return data;
}

export const api = {
  get: (p, o) => request(p, { ...o }),
  post: (p, body, o) => request(p, { method: 'POST', body, ...o }),

  /**
   * A CSV download.
   *
   * Fetched with the token rather than opened as a plain link, because a link
   * carries no Authorization header — the server would refuse it, and the
   * officer would get a 401 page instead of their report.
   */
  async download(path, filename) {
    const res = await fetch(`${API_BASE}/admin/api${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { onToast({ type: 'error', message: 'Could not prepare that report.' }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    onToast({ type: 'ok', message: 'Report downloaded.' });
  },
};
