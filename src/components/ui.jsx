/**
 * The small pieces every page is built from.
 *
 * Kept in one file because they are each a few lines and they only make sense
 * together: a stat tile, a table, a pill, a confirmation. Splitting them into
 * eight files would be filing, not design.
 */

import { useEffect, useState } from 'react';
import { toneClass } from '../lib/format';

/* ─────────────────────────────────────────────────────────────── headings */

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Section({ title, note, right, children, className = '' }) {
  return (
    <section className={`card p-4 lg:p-5 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {note && <p className="text-2xs text-ink-500 mt-0.5">{note}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────── figures */

/**
 * One number, with what it is and what it compares to.
 *
 * `hint` exists because a figure without context is close to useless in a
 * meeting — "₹44,000 today" means one thing beside "₹39,600 yesterday" and
 * quite another on its own.
 */
export function Stat({ label, value, hint, tone, wide }) {
  return (
    <div className={`card p-4 ${wide ? 'sm:col-span-2' : ''}`}>
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tnum ${
        tone === 'refused' ? 'text-refused'
        : tone === 'allowed' ? 'text-allowed'
        : 'text-ink-900'}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-2xs text-ink-500">{hint}</div>}
    </div>
  );
}

export function Pill({ tone, children }) {
  return <span className={`pill ${toneClass(tone)}`}>{children}</span>;
}

/* ───────────────────────────────────────────────────────────────── tables */

/**
 * A table that scrolls sideways inside its own box.
 *
 * Wide data is normal here — a booking row has eleven useful columns — and the
 * page body must never be the thing that scrolls horizontally.
 */
export function Table({ columns, rows, empty = 'Nothing to show.', onRowClick, footer }) {
  if (!rows?.length) {
    return <div className="py-10 text-center text-sm text-ink-500">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto -mx-4 lg:-mx-5">
      <table className="w-full min-w-max">
        <thead className="bg-paper-sunken">
          <tr>{columns.map((c) => (
            <th key={c.key} className={`th ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? r.ticket_no ?? i}
                className={`row ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key}
                    className={`td ${c.align === 'right' ? 'text-right tnum' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="bg-paper-sunken font-semibold">{footer}</tfoot>}
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── state & noise */

export const Loading = ({ what = 'Loading' }) => (
  <div className="py-12 text-center text-sm text-ink-400">{what}…</div>
);

export const Empty = ({ children }) => (
  <div className="py-12 text-center text-sm text-ink-500">{children}</div>
);

/**
 * A confirmation for anything that cannot be undone.
 *
 * Requires typing the confirmation word when `confirmWord` is given. Closing a
 * day refunds real people's money; a single mis-click should not be able to do
 * that.
 */
export function Confirm({ open, title, body, confirmWord, confirmLabel = 'Confirm',
                          danger, onCancel, onConfirm, busy }) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open]);
  if (!open) return null;

  const blocked = confirmWord && typed.trim().toUpperCase() !== confirmWord.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
         onClick={onCancel}>
      <div className="card w-full max-w-md p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        <div className="mt-2 text-sm text-ink-600 space-y-2">{body}</div>

        {confirmWord && (
          <div className="mt-4">
            <label className="label">Type {confirmWord} to confirm</label>
            <input className="input mt-1" value={typed} autoFocus
                   onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'}
                  disabled={blocked || busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A right-hand drawer for detail, so the list behind it keeps its place. */
export function Drawer({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink-900/40" onClick={onClose}>
      <div className="w-full max-w-md bg-paper h-full overflow-y-auto shadow-lift"
           onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-paper-raised border-b border-ink-300/50 px-5 py-3
                        flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          <button className="btn-ghost !px-2.5 !py-1" onClick={onClose}>Close</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── toasts */

export function Toaster({ toast }) {
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!shown) return null;
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-md px-4 py-2.5
                     text-sm font-medium shadow-lift ${
      shown.type === 'error' ? 'bg-refused text-white' : 'bg-ink-900 text-white'}`}>
      {shown.message}
    </div>
  );
}

/** Simple labelled field for forms. */
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="label">{label}</div>
      <div className="mt-1">{children}</div>
      {hint && <div className="mt-1 text-2xs text-ink-500">{hint}</div>}
    </label>
  );
}

/**
 * A horizontal fill bar for capacity.
 *
 * Full is not a good thing here, so the bar warms up as it fills rather than
 * turning green — an officer scanning the page should feel the pressure on a
 * slot without reading the numbers.
 */
export function Fill({ booked, held, capacity }) {
  const b = capacity ? Math.min(100, (booked / capacity) * 100) : 0;
  const h = capacity ? Math.min(100 - b, (held / capacity) * 100) : 0;
  const tone = b > 90 ? 'bg-refused' : b > 70 ? 'bg-pending' : 'bg-forest-700';
  return (
    <div className="h-2 w-full rounded-full bg-paper-sunken overflow-hidden flex">
      <div className={tone} style={{ width: `${b}%` }} />
      <div className="bg-forest-500/40" style={{ width: `${h}%` }} />
    </div>
  );
}
