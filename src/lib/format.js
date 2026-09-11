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

/** 'KA31N8147' → 'KA 31 N 8147'. */
export const plate = (reg) => {
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(String(reg || '').toUpperCase());
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : String(reg || '');
};

export const shiftDay = (date, days) => {
  const [y, m, d] = String(date).split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};
