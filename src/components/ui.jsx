import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { plate } from '../lib/format';
import { onBusyChange } from '../lib/api';

/*
 * The small pieces every settings screen is built from, so a change looks and
 * behaves the same wherever it is made: a dialog, a reason, a result.
 */

/** A dialog over the page. Escape and the backdrop close it unless it is busy. */
export function Modal({ title, subtitle, onClose, children, footer, wide = false, busy = false }) {
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, busy]);

  /* Drawn onto <body>, not where it is written: a dialog opened from inside a
     card that is lifted on hover, or a page that is animating in, would
     otherwise be positioned and clipped by that element instead of the window. */
  return createPortal((
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 py-10" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} shadow-pop`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-2xs text-muted">{subtitle}</p>}
          </div>
          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={onClose} disabled={busy}>Close</button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-shell/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  ), document.body);
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-muted">{hint}</span>}
    </label>
  );
}

const TONES = {
  good: 'border-good-500/25 bg-good-50 text-good-700',
  wrong: 'border-wrong-500/25 bg-wrong-50 text-wrong-700',
  watch: 'border-watch-500/25 bg-watch-50 text-watch-700',
  info: 'border-line bg-shell text-body',
};

export const Banner = ({ tone = 'info', children, className = '' }) => (
  <div className={`rounded-lg border px-4 py-2.5 text-sm ${TONES[tone]} ${className}`}>{children}</div>
);

/** Why the change is being made. Recorded against the person making it. */
export function Reason({ value, onChange, placeholder = 'e.g. Approved by the DCF in the meeting on 10 September' }) {
  const short = value.trim().length > 0 && value.trim().length < 5;
  return (
    <Field label="Reason for this change" hint={short ? 'A few more words, please.' : 'Recorded in the audit log with your name, the time and the values before and after.'}>
      <textarea className="input min-h-[72px] resize-y" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} maxLength={500} />
    </Field>
  );
}

export const reasonOk = (r) => String(r || '').trim().length >= 5;

/**
 * A PIN or password, shown exactly once. The server does not keep it in a form
 * it can show again, so the screen says so plainly.
 */
export function Secret({ label, value, note }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  };
  return (
    <div className="rounded-xl border border-brand-accent/30 bg-good-50 p-4">
      <div className="label !text-good-700">{label}</div>
      <div className="flex items-center gap-3">
        <code className="tabular select-all font-mono text-2xl font-bold tracking-wider text-ink">{value}</code>
        <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <p className="mt-2 text-2xs text-good-700">{note || 'Shown only this once. Share it with the person directly — it is not stored anywhere it can be read back.'}</p>
    </div>
  );
}

/** Run a change: tracks busy and the server's sentence when it refuses. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try { return await fn(); } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

export const Status = ({ active, locked }) => (
  locked ? <span className="chip bg-watch-50 text-watch-700">Locked</span>
    : active ? <span className="chip bg-good-50 text-good-700">Active</span>
      : <span className="chip bg-shell text-muted">Disabled</span>
);

export const when = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return String(iso); }
};

/*
 * A visitor's vehicles, in one line.
 *
 * A fleet owner or a tour operator books under a single mobile number, so this
 * list can run to hundreds of plates. Printed in full it turns the table row
 * into a column of plates hundreds of lines tall and pushes every other figure
 * off the screen. Two plates and a count instead; the rest are on the visitor's
 * own page, and hovering shows the next few without going there.
 */
export function Plates({ list, shown = 2 }) {
  const all = list || [];
  if (all.length === 0) return <span className="text-muted">—</span>;
  const rest = all.length - shown;
  return (
    <span className="whitespace-nowrap">
      {all.slice(0, shown).map(plate).join(', ')}
      {rest > 0 && (
        <span className="ml-1 cursor-help text-muted"
          title={all.slice(shown, shown + 40).map(plate).join(', ') + (rest > 40 ? `, and ${rest - 40} more` : '')}>
          +{rest} more
        </span>
      )}
    </span>
  );
}

/*
 * Waiting, in the shape of what is coming.
 *
 * Blocks the size of the cards or rows about to appear, lit by a slow sweep,
 * so the screen does not jump when the answer lands and nobody is looking at
 * blank white wondering whether it broke. `head` draws the strip of figures
 * some screens carry above their table.
 */
export function Loading({ rows = 4, head = 0 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {head > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: head }, (_, i) => <div key={i} className="skeleton h-[76px]" />)}
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-14" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

/** The same, in the shape of a table: a header strip and its rows. */
export function LoadingTable({ rows = 6, columns = 5 }) {
  return (
    <div className="card overflow-hidden" aria-busy="true">
      <div className="flex gap-4 border-b border-line bg-shell px-4 py-3">
        {Array.from({ length: columns }, (_, i) => <div key={i} className="skeleton h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className={`skeleton h-3.5 ${c === 0 ? 'flex-[1.6]' : 'flex-1'}`} style={{ animationDelay: `${(r * columns + c) * 35}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/*
 * The thin bar across the top of the panel, while the panel is asking the
 * server something. It is deliberately late: a question answered in under a
 * quarter of a second flashes nothing at all, because a bar that appears and
 * vanishes on every click is worse than no bar.
 */
export function BusyBar() {
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => onBusyChange((n) => {
    if (n > 0) {
      clearTimeout(BusyBar.hide);
      BusyBar.show = setTimeout(() => { setDone(false); setShown(true); }, 250);
    } else {
      clearTimeout(BusyBar.show);
      setDone(true);
      BusyBar.hide = setTimeout(() => { setShown(false); setDone(false); }, 320);
    }
  }), []);

  if (!shown) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" role="presentation">
      <div className={`h-full bg-brand-accent shadow-[0_0_8px_rgba(0,168,132,.7)] ${done ? 'w-full transition-all duration-300' : 'bar-creep'}`}
        style={done ? { opacity: 0, transition: 'width .2s ease-out, opacity .3s ease-out .12s' } : undefined} />
    </div>
  );
}
