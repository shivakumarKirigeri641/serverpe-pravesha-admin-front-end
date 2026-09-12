/* Formatting used across every screen, so a number never appears two ways. */

export const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const number = (n) => Number(n || 0).toLocaleString('en-IN');

/** '+12.5%' / '−8%' / '—', with the sign the eye reads first. */
export const percent = (p) => {
  if (p === null || p === undefined) return null;
  const rounded = Math.abs(p) >= 100 ? Math.round(p) : p;
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(rounded)}%`;
};

export const clock = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return ''; }
};

export const dayLabel = (date) => {
  if (!date) return '';
  try {
    return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return date; }
};

/*
 * A number plate, exactly as it is written on the vehicle.
 *
 * This used to group it — KA 31 N 8147 — which reads nicely in print and badly
 * everywhere the number is actually used: staff compare what is on screen with
 * the metal in front of them character by character, a plate is searched for and
 * pasted as one word, and inserted spaces are one more difference to discount
 * every time. It is shown the way it is stored and the way it is typed.
 */
export const plate = (reg) => String(reg || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const shiftDay = (date, days) => {
  const [y, m, d] = String(date).split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};
