import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend as RLegend } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import usePulse from '../lib/usePulse';
import Rolling from '../components/Rolling.jsx';
import { useSession, can } from '../lib/session';
import { dayLabel, number, plate } from '../lib/format';
import { Banner, Field, Loading, Modal, useAction, when } from '../components/ui.jsx';

/*
 * Payments & Settlements — every payment attempt, and where each rupee went
 * after it.
 *
 * The split is the point of this screen: a visitor pays one amount, and it is
 * not all Pravesha's. The entry fee belongs to the Tourism Department and is
 * remitted to them; the service fee is Pravesha's, and GST and the gateway's
 * charges come out of it. Two settlements follow — Razorpay to Pravesha's bank,
 * and Pravesha to the Department — and both are shown per payment.
 */

const inr = (v, { decimals = true } = {}) => {
  const x = Number(v || 0);
  return `${x < 0 ? '−' : ''}₹${Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`;
};
const inr0 = (v) => inr(v, { decimals: false });

const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['last7', '7 days'], ['thisMonth', 'This month'], ['prevMonth', 'Previous month'], ['custom', 'Custom']];

const STATES = {
  successful: ['Successful', 'bg-good-50 text-good-700'],
  failed: ['Failed', 'bg-wrong-50 text-wrong-700'],
  pending: ['Pending', 'bg-watch-50 text-watch-700'],
  refunded: ['Refunded', 'bg-wrong-50 text-wrong-700'],
  partial_refund: ['Partly refunded', 'bg-watch-50 text-watch-700'],
};

export default function Payments() {
  const { me } = useSession();
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const params = preset === 'custom'
    ? (custom.from && custom.to ? { preset, from: custom.from, to: custom.to } : null)
    : { preset };
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    try { setData(await api.paymentsOverview(params)); setError(null); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  usePulse(load);

  const p = data?.period;

  return (
    <Shell title="Payments & Settlements"
      subtitle={p ? `${dayLabel(p.from)}${p.to !== p.from ? ` – ${dayLabel(p.to)}` : ''}` : 'Payments, failures, refunds and how each rupee is settled'}>
      <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <div className="label">Period</div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-1">
            {PRESETS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setPreset(k)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${preset === k ? 'bg-brand text-white' : 'text-body hover:bg-shell'}`}>{label}</button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <div>
            <div className="label">From – to</div>
            <div className="flex items-center gap-1.5">
              <input type="date" className="input !w-auto !py-2" max={p?.today} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <span className="text-muted">–</span>
              <input type="date" className="input !w-auto !py-2" max={p?.today} min={custom.from || undefined} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {preset === 'custom' && !params && <p className="card mb-4 px-4 py-10 text-center text-sm text-muted">Choose a start and end date.</p>}
      {loading && !data && <Loading rows={4} />}

      {data && (
        <div className={`space-y-7 ${loading ? 'opacity-60' : ''}`}>
          <Counts data={data} />
          <Split data={data} />
          <Settlements data={data} period={params} canRemit={can(me, 'finance.remit')} />
          <PaymentList period={params} onOpen={setOpen} />
        </div>
      )}
      {open && <PaymentDrawer id={open} onClose={() => setOpen(null)} />}
    </Shell>
  );
}

/* ──────────────────────────────────────────────────────────── counts ── */

const Section = ({ title, note, children, actions }) => (
  <section>
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {note && <p className="text-2xs text-muted">{note}</p>}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

function Counts({ data }) {
  const c = data.counts;
  const cards = [
    ['Successful payments', c.successful, 'text-good-700'],
    ['Failed payments', c.failed, 'text-wrong-700'],
    ['Pending payments', c.pending, 'text-watch-700'],
    ['Refunds', c.refunded, 'text-wrong-700'],
    ['Partial refunds', c.partial, 'text-watch-700'],
  ];
  return (
    <Section title="Payments" note={c.successRate === null ? 'No attempts in this period' : `${c.successRate}% of attempts succeeded`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, v, tone]) => (
          <div key={label} className="card p-4">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
            <div className={`tabular mt-1.5 text-2xl font-bold leading-none ${v.count ? tone : 'text-ink'}`}><Rolling text={number(v.count)} /></div>
            <div className="mt-2 text-2xs text-muted">{inr0(v.amount)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Attempts by day</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip labelFormatter={dayLabel} contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', fontSize: 13 }} />
                <RLegend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="successful" name="Successful" stackId="a" fill="#12a150" radius={[3, 3, 0, 0]} />
                <Bar dataKey="failed" name="Failed" stackId="a" fill="#d92d20" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#e08700" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Why payments failed</h3>
          {data.failureReasons.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">No failures in this period.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.failureReasons.map((r) => (
                <li key={r.reason}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-body">{r.reason}</span>
                    <span className="tabular font-semibold text-ink">{number(r.count)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-shell">
                    <div className="h-full bg-wrong-500/70" style={{ width: `${(r.count / data.failureReasons[0].count) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────────────────────────────────────── the split ── */

function Split({ data }) {
  const s = data.split;
  const pc = (v) => (s.visitorPaid ? `${Math.round((v / s.visitorPaid) * 1000) / 10}%` : '—');
  return (
    <Section title="Payment split" note="Where the money visitors paid in this period went">
      <div className="card p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="rounded-xl border border-line p-4">
              <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Visitors paid</div>
              <div className="tabular text-3xl font-bold text-ink"><Rolling text={inr(s.visitorPaid)} /></div>
              {s.refunded > 0 && <div className="mt-1 text-2xs text-wrong-700">{inr(s.refunded)} refunded</div>}
            </div>
            <div className="my-2 pl-6 text-muted">↓</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Tourism Department</div>
                <div className="tabular text-xl font-bold text-ink">{inr(s.department)}</div>
                <div className="mt-1 text-2xs text-muted">{pc(s.department)} · entry fees, collected as pure agent</div>
              </div>
              <div className="rounded-xl border border-brand/30 bg-brand/[0.03] p-4">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Pravesha</div>
                <div className="tabular text-xl font-bold text-ink">{inr(s.pravesha)}</div>
                <div className="mt-1 text-2xs text-muted">{pc(s.pravesha)} · service fee, GST included</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Out of Pravesha’s service fee</div>
            <dl className="mt-2 divide-y divide-line rounded-xl border border-line">
              {[
                ['Service fee collected', s.pravesha, 'text-ink'],
                ['GST within the fee', -s.gst, 'text-watch-700'],
                ['Payment gateway charges', -s.gateway, 'text-watch-700'],
              ].map(([label, v, tone]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-body">{label}</dt>
                  <dd className={`tabular font-semibold ${tone}`}>{inr(v)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 bg-shell px-4 py-3">
                <dt className="text-sm font-semibold text-ink">Pravesha net revenue</dt>
                <dd className="tabular text-lg font-bold text-good-700">{inr(s.net)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-2xs text-muted">
              The gateway charges a percentage of the whole amount, including the Department’s entry fee — so on a {inr0(113)} payment the fee is taken on {inr0(113)}, not on {inr0(13)}.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────── settlements ── */

function Settlements({ data, period, canRemit }) {
  const s = data.settlement;
  const [rem, setRem] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api.remittances().then(setRem).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  usePulse(load);

  return (
    <Section title="Settlements" note="Razorpay to Pravesha’s bank, and Pravesha to the Tourism Department"
      actions={canRemit && <button type="button" className="btn-primary" onClick={() => setAdding(true)}>Record remittance</button>}>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Gateway → Pravesha</h3>
          <p className="text-2xs text-muted">Razorpay settles to the bank account, less its fee, about two days after payment.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line p-3">
              <div className="text-2xs text-muted">Settled</div>
              <div className="tabular text-xl font-bold text-good-700">{inr0(s.gateway.settledAmount)}</div>
              <div className="text-2xs text-muted">{number(s.gateway.settled)} payments</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="text-2xs text-muted">Awaiting settlement</div>
              <div className="tabular text-xl font-bold text-watch-700">{inr0(s.gateway.pendingAmount)}</div>
              <div className="text-2xs text-muted">{number(s.gateway.pending)} payments</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Pravesha → Tourism Department</h3>
          <p className="text-2xs text-muted">Entry fees collected on their behalf, net of refunds, remitted in batches.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line p-3">
              <div className="text-2xs text-muted">Remitted</div>
              <div className="tabular text-xl font-bold text-good-700">{inr0(s.department.remitted)}</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="text-2xs text-muted">Still due</div>
              <div className={`tabular text-xl font-bold ${s.department.due ? 'text-watch-700' : 'text-ink'}`}>{inr0(s.department.due)}</div>
            </div>
          </div>
          {rem?.outstanding?.amount > 0 && (
            <p className="mt-3 text-2xs text-muted">
              Across all dates, {inr0(rem.outstanding.amount)} of entry fees is not covered by any remittance
              {rem.outstanding.from ? ` (${dayLabel(rem.outstanding.from)} onwards)` : ''}.
            </p>
          )}
        </div>
      </div>

      {rem?.remittances?.length > 0 && (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-line bg-shell">
              <tr><th className="th">Covers</th><th className="th text-right">Amount</th><th className="th">Reference</th><th className="th">Paid on</th><th className="th">Note</th><th className="th">Recorded by</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rem.remittances.map((r) => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap text-sm text-ink">{dayLabel(r.coversFrom)} – {dayLabel(r.coversTo)}</td>
                  <td className="td tabular text-right font-semibold text-ink">{inr0(r.amount)}</td>
                  <td className="td font-mono text-2xs">{r.reference}{r.test && <span className="chip ml-1.5 bg-watch-50 text-watch-700">Test</span>}</td>
                  <td className="td whitespace-nowrap text-sm">{dayLabel(r.remittedOn)}</td>
                  <td className="td max-w-xs text-2xs text-muted">{r.note || '—'}</td>
                  <td className="td text-2xs text-muted">{r.createdBy || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <RemittanceForm period={period} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </Section>
  );
}

function RemittanceForm({ period, onClose, onSaved }) {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const [f, setF] = useState({ coversFrom: '', coversTo: '', amount: '', reference: '', remittedOn: today, note: '' });
  const [due, setDue] = useState(null);
  /* The amount follows the dates until it is typed over, and then it is theirs. */
  const [typedAmount, setTypedAmount] = useState(false);
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (!f.coversFrom || !f.coversTo || f.coversFrom > f.coversTo) { setDue(null); return undefined; }
    let alive = true;
    api.remittanceDue(f.coversFrom, f.coversTo).then((d) => {
      if (!alive) return;
      setDue(d);
      if (!typedAmount) setF((x) => ({ ...x, amount: String(d.amount) }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [f.coversFrom, f.coversTo, typedAmount]);

  return (
    <Modal title="Record a remittance to the Department" subtitle="Entry fees passed on, net of refunds" onClose={onClose} busy={busy} wide
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy || !f.coversFrom || !f.coversTo || !(Number(f.amount) > 0) || f.reference.trim().length < 4}
          onClick={async () => { if (await run(() => api.addRemittance({ ...f, amount: Number(f.amount) }))) onSaved(); }}>
          {busy ? 'Saving…' : 'Record remittance'}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Covers payments from"><input type="date" className="input" max={today} value={f.coversFrom} onChange={set('coversFrom')} /></Field>
        <Field label="to"><input type="date" className="input" max={today} min={f.coversFrom || undefined} value={f.coversTo} onChange={set('coversTo')} /></Field>
        <Field label="Amount remitted (₹)" hint={due ? `Entry fees due for these dates: ₹${due.amount.toLocaleString('en-IN')} across ${number(due.payments)} payments` : 'Choose the dates to see what is due'}>
          <input type="number" min="0" step="0.01" className="input tabular" value={f.amount}
            onChange={(e) => { setTypedAmount(true); set('amount')(e); }} />
        </Field>
        <Field label="Bank reference" hint="UTR, NEFT or RTGS number"><input className="input font-mono" value={f.reference} onChange={set('reference')} /></Field>
        <Field label="Paid on"><input type="date" className="input" max={today} value={f.remittedOn} onChange={set('remittedOn')} /></Field>
        <Field label="Note" hint="Required if the amount differs from what is due"><input className="input" value={f.note} maxLength={500} onChange={set('note')} /></Field>
      </div>
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

/* ───────────────────────────────────────────────────── payment list ── */

function PaymentList({ period, onOpen }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [state, setState] = useState('');
  const [allDates, setAllDates] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const size = 25;

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  const periodKey = JSON.stringify(period);
  useEffect(() => { setPage(0); }, [periodKey]);
  const key = JSON.stringify([periodKey, term, state, allDates, page]);

  useEffect(() => {
    let alive = true;
    api.paymentsList({ ...(allDates ? { allDates: 1 } : period), q: term, state, limit: size, offset: page * size })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <Section title="Payments" note={allDates ? 'All dates · newest first' : 'In the selected period · newest first'}>
      <div className="card mb-3 grid gap-3 p-4 lg:grid-cols-[2fr_auto_auto]">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by payment ID, order ID, refund ID, pass number, vehicle, mobile or name" />
        <select className="input" value={state} onChange={(e) => { setState(e.target.value); setPage(0); }} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATES).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-brand" checked={allDates} onChange={(e) => { setAllDates(e.target.checked); setPage(0); }} />
          Search all dates
        </label>
      </div>

      {error && <Banner tone="wrong" className="mb-3">{error}</Banner>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">When</th><th className="th">Payment</th><th className="th">Ticket</th><th className="th">Visitor</th>
              <th className="th text-right">Amount</th><th className="th text-right">Department</th><th className="th text-right">Pravesha</th>
              <th className="th text-right">GST</th><th className="th text-right">Gateway</th><th className="th">Status</th><th className="th">Settlement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!data && <tr><td colSpan={11} className="h-24 animate-pulse" /></tr>}
            {data?.payments.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">No payments match.</td></tr>}
            {data?.payments.map((p) => {
              const [label, tone] = STATES[p.state] || [p.state, 'bg-shell text-muted'];
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-shell/50" onClick={() => onOpen(p.id)}>
                  <td className="td whitespace-nowrap text-2xs text-muted">{when(p.at)}</td>
                  <td className="td"><div className="font-mono text-2xs text-ink">{p.paymentId || p.orderId || '—'}</div>{p.refundId && <div className="font-mono text-2xs text-wrong-700">{p.refundId}</div>}</td>
                  <td className="td"><div className="font-mono text-sm">{p.ticketNo || '—'}</div><div className="font-mono text-2xs text-muted">{p.regNo ? plate(p.regNo) : ''}</div></td>
                  <td className="td"><div className="text-sm text-ink">{p.visitor || '—'}</div><div className="text-2xs text-muted">{p.mobile}</div></td>
                  <td className="td tabular text-right font-semibold text-ink">{inr(p.amount)}{p.refunded > 0 && <div className="text-2xs font-normal text-wrong-700">−{inr(p.refunded)}</div>}</td>
                  <td className="td tabular text-right">{inr(p.department)}</td>
                  <td className="td tabular text-right">{inr(p.fee)}</td>
                  <td className="td tabular text-right text-muted">{inr(p.gst)}</td>
                  <td className="td tabular text-right text-muted">{p.gatewayFee === null ? '—' : inr(p.gatewayFee)}</td>
                  <td className="td"><span className={`chip ${tone}`}>{label}</span></td>
                  <td className="td">
                    {p.gatewaySettlement ? (
                      <div className="space-y-0.5 text-2xs">
                        <div className={p.gatewaySettlement.status === 'settled' ? 'text-good-700' : 'text-watch-700'}>
                          Gateway: {p.gatewaySettlement.status === 'settled' ? 'settled' : 'pending'}
                        </div>
                        <div className={p.departmentSettlement.status === 'remitted' ? 'text-good-700' : 'text-watch-700'}>
                          Department: {p.departmentSettlement.status === 'remitted' ? 'remitted' : 'due'}
                        </div>
                      </div>
                    ) : <span className="text-2xs text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">{number(page * size + 1)}–{number(Math.min(data.total, (page + 1) * size))} of {number(data.total)}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-quiet !py-1.5" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>Newer</button>
              <span className="text-2xs text-muted">Page {page + 1} of {number(pages)}</span>
              <button type="button" className="btn-quiet !py-1.5" disabled={page + 1 >= pages} onClick={() => setPage((x) => x + 1)}>Older</button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────── payment detail ── */

function PaymentDrawer({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { setData(null); api.payment(id).then(setData).catch((e) => setError(e.message)); }, [id]);

  const s = data?.split;
  const [label, tone] = data ? (STATES[data.payment.state] || [data.payment.state, 'bg-shell text-muted']) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="truncate font-mono text-base font-bold text-ink">{data?.payment.paymentId || data?.payment.orderId || `Payment #${id}`}</div>
            {data && <span className={`chip mt-1 ${tone}`}>{label}</span>}
          </div>
          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={onClose}>Close</button>
        </div>

        {error && <div className="p-5"><Banner tone="wrong">{error}</Banner></div>}
        {!data && !error && <div className="p-5"><Loading rows={3} /></div>}

        {data && (
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail title="Payment" rows={[
                ['Payment ID', data.payment.paymentId || '—'],
                ['Order ID', data.payment.orderId || '—'],
                ['Method', data.payment.method || '—'],
                ['Opened', when(data.payment.createdAt)],
                ['Paid', data.payment.paidAt ? when(data.payment.paidAt) : '—'],
                ['Refund ID', data.payment.refundId || '—'],
              ]} />
              <Detail title="Pass" rows={data.ticket ? [
                ['Pass number', data.ticket.ticketNo],
                ['Vehicle', `${plate(data.ticket.regNo)} · ${data.ticket.vehicleType}`],
                ['Destination', data.ticket.place],
                ['Visit', `${dayLabel(data.ticket.travelDate)} · ${data.ticket.slot}`],
                ['Pass status', data.ticket.status],
                ['Invoice', data.ticket.invoiceNo || '—'],
              ] : [['Pass', 'No pass — the payment was never completed']]} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Where this payment went</h3>
              <dl className="divide-y divide-line rounded-xl border border-line">
                <Row label="Visitor paid" value={inr(s.visitorPaid)} strong />
                {s.refunded > 0 && <Row label="Refunded" value={`−${inr(s.refunded)}`} tone="text-wrong-700" />}
                <Row label="Tourism Department (entry fee)" value={inr(s.department)} indent />
                <Row label="Pravesha service fee" value={inr(s.pravesha)} indent />
                <Row label="GST within the fee" value={`−${inr(s.gst)}`} indent2 tone="text-watch-700" />
                <Row label="Gateway charges" value={s.gateway === null ? 'not reported yet' : `−${inr(s.gateway)}`} indent2 tone="text-watch-700" />
                <Row label="Pravesha net revenue" value={inr(s.net)} strong tone="text-good-700" />
              </dl>
              {!s.counted && <p className="mt-2 text-2xs text-muted">This payment did not complete, so none of it was counted.</p>}
            </div>

            {data.settlement.gateway && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail title="Gateway settlement" rows={data.settlement.gateway.status === 'settled' ? [
                  ['Status', 'Settled'], ['On', when(data.settlement.gateway.at)],
                  ['Amount', inr(data.settlement.gateway.amount)], ['UTR', data.settlement.gateway.utr || '—'],
                ] : [['Status', 'Awaiting settlement from Razorpay']]} />
                <Detail title="Department remittance" rows={data.settlement.department.status === 'remitted' ? [
                  ['Status', 'Remitted'], ['On', dayLabel(data.settlement.department.on)], ['Reference', data.settlement.department.reference],
                ] : [['Status', 'Due'], ['Amount', inr(data.settlement.department.amount)]]} />
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">History</h3>
              <ol className="space-y-2.5 border-l border-line pl-4">
                {data.timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-accent" />
                    <div className="text-sm text-ink">{t.what}</div>
                    <div className="text-2xs text-muted">{when(t.at)}{t.detail ? ` · ${t.detail}` : ''}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const Detail = ({ title, rows }) => (
  <div className="rounded-xl border border-line">
    <div className="border-b border-line px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-muted">{title}</div>
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
          <dt className="text-muted">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const Row = ({ label, value, strong, indent, indent2, tone = 'text-ink' }) => (
  <div className={`flex items-baseline justify-between gap-3 px-4 py-2.5 ${strong ? 'bg-shell' : ''}`}>
    <dt className={`text-sm ${indent2 ? 'pl-8' : indent ? 'pl-4' : ''} ${strong ? 'font-semibold text-ink' : 'text-body'}`}>
      {(indent || indent2) && <span className="mr-1.5 text-muted">↳</span>}{label}
    </dt>
    <dd className={`tabular text-sm font-semibold ${tone}`}>{value}</dd>
  </div>
);
