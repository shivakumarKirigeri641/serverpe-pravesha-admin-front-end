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
    throw new ApiError(data.message || 'The file could not be generated.', { status: res.status });
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
  negative: () => call('/negative'),
  negativeEvents: ({ category, q, from, to, before, limit = 25 } = {}) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (category) qs.set('category', category);
    if (q) qs.set('q', q);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (before) qs.set('before', before);
    return call(`/negative/events?${qs}`);
  },
  negativeVehicle: (regNo) => call(`/negative/vehicle/${encodeURIComponent(regNo)}`),
  negativeVisitor: (id) => call(`/negative/visitor/${encodeURIComponent(id)}`),
  negativeReview: (body) => call('/negative/review', { method: 'POST', body }),
  negativeBlock: (id, body) => call(`/negative/visitor/${encodeURIComponent(id)}/block`, { method: 'POST', body }),
  report: (params) => call(`/reports?${new URLSearchParams(params)}`),
  reportFile: (params, format) => file(`/reports/download?${new URLSearchParams({ ...params, format })}`),
  reportHistory: () => call('/reports/history'),
  conversations: ({ q = null } = {}) => call(`/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  conversation: (id) => call(`/conversations/${encodeURIComponent(id)}`),
  /* Ticket Management. */
  ticketSearch: (params) => call(`/tickets/search?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))}`),
  ticket: (id) => call(`/tickets/${encodeURIComponent(id)}/detail`),
  passFile: (id) => file(`/tickets/${id}/pass.pdf`),
  cancelTicket: (id, reason) => call(`/tickets/${id}/cancel`, { method: 'POST', body: { reason } }),
  resendTicket: (id, reason) => call(`/tickets/${id}/resend`, { method: 'POST', body: { reason } }),
  /* Payments & Settlements. */
  paymentsOverview: (params) => call(`/payments/overview?${new URLSearchParams(params)}`),
  paymentsList: (params) => call(`/payments/list?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))}`),
  payment: (id) => call(`/payments/${id}`),
  remittances: () => call('/payments/remittances'),
  remittanceDue: (from, to) => call(`/payments/remittances/due?from=${from}&to=${to}`),
  addRemittance: (body) => call('/payments/remittances', { method: 'POST', body }),
  /* My GST & Invoices. */
  financeSummary: (params) => call(`/finance/summary?${new URLSearchParams(params)}`),
  financeInvoices: (params) => call(`/finance/invoices?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))}`),
  invoiceFile: (id) => file(`/finance/invoices/${id}/pdf`),
  expenses: (params) => call(`/finance/expenses?${new URLSearchParams(params)}`),
  addExpense: (body) => call('/finance/expenses', { method: 'POST', body }),
  removeExpense: (id, reason) => call(`/finance/expenses/${id}`, { method: 'DELETE', body: { reason } }),
  setGatewayItc: (include, reason) => call('/finance/itc-gateway', { method: 'PUT', body: { include, reason } }),
  /* Settings. Every change carries a reason; the server refuses one without. */
  pricing: (placeId) => call(`/settings/pricing${placeId ? `?placeId=${placeId}` : ''}`),
  updatePricing: (body) => call('/settings/pricing', { method: 'PUT', body }),
  slots: (placeId) => call(`/settings/slots${placeId ? `?placeId=${placeId}` : ''}`),
  createSlot: (body) => call('/settings/slots', { method: 'POST', body }),
  updateSlot: (id, body) => call(`/settings/slots/${id}`, { method: 'PUT', body }),
  deleteSlot: (id, reason) => call(`/settings/slots/${id}`, { method: 'DELETE', body: { reason } }),
  staff: () => call('/settings/staff'),
  addStaff: (body) => call('/settings/staff', { method: 'POST', body }),
  updateStaff: (id, body) => call(`/settings/staff/${id}`, { method: 'PUT', body }),
  setStaffActive: (id, active, reason) => call(`/settings/staff/${id}/active`, { method: 'POST', body: { active, reason } }),
  resetStaffPin: (id, reason) => call(`/settings/staff/${id}/reset-pin`, { method: 'POST', body: { reason } }),
  staffActivity: (id) => call(`/settings/staff/${id}/activity`),
  users: () => call('/settings/users'),
  addUser: (body) => call('/settings/users', { method: 'POST', body }),
  updateUser: (id, body) => call(`/settings/users/${id}`, { method: 'PUT', body }),
  setUserActive: (id, active, reason) => call(`/settings/users/${id}/active`, { method: 'POST', body: { active, reason } }),
  resetUserPassword: (id, reason) => call(`/settings/users/${id}/reset-password`, { method: 'POST', body: { reason } }),
  permissions: () => call('/settings/permissions'),
  gst: () => call('/settings/gst'),
  updateGst: (body) => call('/settings/gst', { method: 'PUT', body }),
  ticketAvailability: (date) => call(`/tickets/availability${date ? `?date=${date}` : ''}`),
  ticketGrants: (kind) => call(`/tickets/grants${kind ? `?kind=${kind}` : ''}`),
  issueFree: (body) => call('/tickets/free', { method: 'POST', body }),
  issueOnspot: (body) => call('/tickets/onspot', { method: 'POST', body }),
  audit: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    return call(`/audit?${qs}`);
  },
  liveActivity: ({ before = null, limit = 25 } = {}) =>
    call(`/live/activity?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`),
};
