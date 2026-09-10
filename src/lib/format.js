/**
 * How numbers, dates and verdicts are written on screen.
 *
 * Money is stored in paise and must never be rendered by dividing in a template
 * — one place formats it, so a rupee looks the same on every screen and in
 * every exported report.
 */

/** Paise to rupees, Indian grouping, decimals only when there are any: 11000 -> "110". */
export function rs(paise, { decimals = false } = {}) {
  const n = (Number(paise) || 0) / 100;
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals || n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** With the symbol, for headline figures. */
export const rupees = (paise, o) => `₹${rs(paise, o)}`;

/** 1234 -> "1,234" */
export const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-13" -> "Sun, 13 Sep" */
export function shortDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return `${DAY[dt.getUTCDay()]}, ${day} ${MON[m - 1]}`;
}

/** "2026-09-13" -> "13 Sep 2026" */
export function longDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return `${day} ${MON[m - 1]} ${y}`;
}

/** A timestamp as "13 Sep, 7:42 am" — the form a person reads off a log. */
export function when(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${d.getDate()} ${MON[d.getMonth()]}, ${time}`;
}

export const timeOnly = (ts) => (ts
  ? new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  : '');

export const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** KA31N8147 -> KA 31 N 8147 */
export function plate(reg) {
  if (!reg) return '';
  const m = String(reg).match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : reg;
}

/**
 * The eight gate verdicts, in the words a person would use.
 *
 * `tone` drives the colour, and the colour means something: green is a vehicle
 * that was let in, red is one that was refused for a reason that suggests
 * tampering, amber is a genuine ticket presented at the wrong moment.
 */
export const VERDICTS = {
  valid:             { label: 'Allowed',        tone: 'allowed' },
  already_used:      { label: 'Already used',   tone: 'refused' },
  invalid_signature: { label: 'Fake ticket',    tone: 'refused' },
  unknown_ticket:    { label: 'Not found',      tone: 'refused' },
  cancelled:         { label: 'Cancelled',      tone: 'refused' },
  wrong_day:         { label: 'Wrong day',      tone: 'pending' },
  wrong_slot:        { label: 'Wrong time',     tone: 'pending' },
  wrong_place:       { label: 'Wrong gate',     tone: 'pending' },
};

export const verdict = (v) => VERDICTS[v] || { label: v, tone: 'pending' };

export const TICKET_STATUS = {
  paid:      { label: 'Booked',    tone: 'allowed' },
  used:      { label: 'Entered',   tone: 'forest' },
  held:      { label: 'Unpaid',    tone: 'pending' },
  expired:   { label: 'Expired',   tone: 'muted' },
  cancelled: { label: 'Refunded',  tone: 'refused' },
};

export const toneClass = (tone) => ({
  allowed: 'bg-allowed-soft text-allowed',
  refused: 'bg-refused-soft text-refused',
  pending: 'bg-pending-soft text-pending',
  forest:  'bg-forest-100 text-forest-900',
  muted:   'bg-paper-sunken text-ink-500',
}[tone] || 'bg-paper-sunken text-ink-500');
