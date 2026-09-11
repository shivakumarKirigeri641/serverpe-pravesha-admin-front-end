import { Fragment, useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { Banner, Loading, when } from '../components/ui.jsx';

/*
 * Audit trail — who did what, when, from where, and why.
 *
 * Every change made in the panel writes a row: the person and their role, the
 * action, what it touched, the values before and after, the reason they gave,
 * and the IP address and session it came from. Nothing here can be edited or
 * deleted from the panel.
 */

const ACTIONS = {
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  view_conversation_technical: 'Opened technical conversation details',
  pricing_changed: 'Changed prices',
  slot_created: 'Added a slot',
  slot_updated: 'Changed a slot',
  slot_deleted: 'Deleted a slot',
  staff_added: 'Added gate staff',
  staff_updated: 'Changed gate staff',
  staff_access_changed: 'Enabled / disabled gate staff',
  staff_pin_reset: 'Reset a gate PIN',
  user_added: 'Added a panel user',
  user_updated: 'Changed a panel user',
  user_access_changed: 'Enabled / disabled a panel user',
  user_password_reset: 'Reset a password',
  gst_business_changed: 'Changed GST or business details',
  free_ticket_issued: 'Issued a free pass',
  onspot_ticket_issued: 'Sold an on-spot pass',
  report_downloaded: 'Downloaded a report',
  invoice_opened: 'Opened an invoice',
  expense_recorded: 'Recorded an expense',
  remittance_recorded: 'Recorded a remittance to the Department',
  expense_removed: 'Removed an expense',
  itc_setting_changed: 'Changed how ITC is counted',
  negative_reviewed: 'Reviewed negative activity',
  negative_dismissed: 'Dismissed negative activity',
  negative_escalated: 'Escalated negative activity',
  visitor_blocked: 'Blocked a visitor',
  visitor_unblocked: 'Unblocked a visitor',
};
const actionLabel = (a) => ACTIONS[a] || String(a || '').replace(/_/g, ' ');

const TONE = (a) => (/deleted|blocked|access_changed|reset/.test(a) ? 'bg-watch-50 text-watch-700'
  : /pricing|gst|itc|expense_removed/.test(a) ? 'bg-wrong-50 text-wrong-700'
    : /sign_in|sign_out|downloaded|view_|opened/.test(a) ? 'bg-shell text-muted' : 'bg-brand/10 text-brand');

export default function Audit() {
  const [filters, setFilters] = useState({ q: '', action: '', adminId: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ actions: [], people: [] });
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async (f, before = null) => {
    try {
      const d = await api.audit({ ...f, before, limit: 50 });
      setRows((r) => (before ? [...(r || []), ...d.entries] : d.entries));
      setCursor(d.nextCursor);
      setMeta({ actions: d.actions, people: d.people });
      setError(null);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { setRows(null); load(applied); }, [applied, load]);

  /* Search as you type, a moment after the typing stops. */
  useEffect(() => {
    const t = setTimeout(() => setApplied(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const any = Object.values(filters).some(Boolean);

  return (
    <Shell title="Audit trail" subtitle="Every change made in the panel: who, what, when, before and after, and why">
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1fr_auto_auto_auto]">
        <input className="input" placeholder="Search person, action, subject or reason" value={filters.q} onChange={set('q')} />
        <select className="input" value={filters.action} onChange={set('action')} aria-label="Action">
          <option value="">All actions</option>
          {meta.actions.map((a) => <option key={a.action} value={a.action}>{actionLabel(a.action)} ({a.count})</option>)}
        </select>
        <select className="input" value={filters.adminId} onChange={set('adminId')} aria-label="Person">
          <option value="">Everyone</option>
          {meta.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" className="input" value={filters.from} onChange={set('from')} aria-label="From" />
        <input type="date" className="input" value={filters.to} min={filters.from || undefined} onChange={set('to')} aria-label="To" />
        <button type="button" className="btn-quiet" disabled={!any} onClick={() => setFilters({ q: '', action: '', adminId: '', from: '', to: '' })}>Clear</button>
      </div>

      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {!rows && !error && <Loading rows={6} />}

      {rows && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-line bg-shell">
              <tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Subject</th><th className="th">Reason</th><th className="th">From</th><th className="th" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">Nothing matches.</td></tr>}
              {rows.map((r) => {
                const detail = r.before || r.after || (r.detail && Object.keys(r.detail).length);
                return (
                  <Fragment key={r.id}>
                    <tr className={`align-top ${open === r.id ? 'bg-shell/60' : 'hover:bg-shell/40'}`}>
                      <td className="td whitespace-nowrap text-2xs text-muted">{when(r.at)}</td>
                      <td className="td"><div className="text-sm font-medium text-ink">{r.who}</div><div className="text-2xs text-muted">{r.role}</div></td>
                      <td className="td"><span className={`chip ${TONE(r.action)}`}>{actionLabel(r.action)}</span></td>
                      <td className="td font-mono text-2xs text-body">{r.subject || '—'}</td>
                      <td className="td max-w-xs text-sm text-body">{r.reason || <span className="text-muted">—</span>}</td>
                      <td className="td whitespace-nowrap text-2xs text-muted">{r.ip || '—'}{r.sessionId && <div>session #{r.sessionId}</div>}</td>
                      <td className="td text-right">
                        {detail ? (
                          <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setOpen(open === r.id ? null : r.id)}>
                            {open === r.id ? 'Hide' : 'Changes'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr className="bg-shell/60">
                        <td colSpan={7} className="px-4 pb-4"><Changes before={r.before} after={r.after} detail={r.detail} /></td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {cursor && (
            <div className="border-t border-line p-3 text-center">
              <button type="button" className="btn-quiet" disabled={loadingMore}
                onClick={async () => { setLoadingMore(true); await load(applied, cursor); setLoadingMore(false); }}>
                {loadingMore ? 'Loading…' : 'Load older entries'}
              </button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ─────────────────────────────────────────────── before and after ── */

const flatten = (value, prefix = '', out = {}) => {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    /* A list of priced things reads best keyed by its code. */
    if (value.every((v) => v && typeof v === 'object' && 'code' in v)) {
      value.forEach((v) => { const { code, ...rest } = v; flatten(rest, `${prefix}${code} · `, out); });
    } else out[prefix.replace(/ · $/, '')] = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    return out;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => {
      if (v && typeof v === 'object') flatten(v, `${prefix}${k} · `, out);
      else out[`${prefix}${k}`] = v;
    });
    return out;
  }
  out[prefix.replace(/ · $/, '') || 'value'] = value;
  return out;
};

const show = (v) => (v === undefined ? '—' : v === null || v === '' ? 'empty' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));
const human = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function Changes({ before, after, detail }) {
  const b = flatten(before);
  const a = flatten(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];

  if (!keys.length) {
    return <pre className="overflow-x-auto rounded-lg border border-line bg-white p-3 font-mono text-2xs text-body">{JSON.stringify(detail, null, 2)}</pre>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <table className="w-full">
        <thead className="border-b border-line bg-shell">
          <tr><th className="th">Field</th><th className="th">Before</th><th className="th">After</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {keys.map((k) => {
            const changed = show(b[k]) !== show(a[k]);
            return (
              <tr key={k} className={changed ? '' : 'text-muted'}>
                <td className="px-4 py-2 text-2xs font-medium">{human(k)}</td>
                <td className={`px-4 py-2 font-mono text-2xs ${changed ? 'text-wrong-700 line-through decoration-wrong-500/40' : ''}`}>{before === null ? '—' : show(b[k])}</td>
                <td className={`px-4 py-2 font-mono text-2xs ${changed ? 'font-semibold text-good-700' : ''}`}>{after === null ? 'removed' : show(a[k])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
