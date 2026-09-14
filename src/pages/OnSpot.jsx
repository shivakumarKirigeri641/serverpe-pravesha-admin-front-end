import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import Photos from '../components/Photos.jsx';
import { api } from '../lib/api';
import usePulse from '../lib/usePulse';
import { dayLabel, number, plate, rupees } from '../lib/format';
import { Banner, Loading, when } from '../components/ui.jsx';

/*
 * Gate sales — passes sold at a barrier, and the money taken for them.
 *
 * WHY THIS IS ITS OWN SCREEN. Every other sale is a card payment that lands in a
 * bank account whether anybody watches it or not. These are cash in somebody's
 * hand, a UPI reference read off a stranger's phone, a card slip in a drawer.
 * Nothing about them reconciles itself, and the gap between what was sold and
 * what was handed over is the entire risk — so it belongs on a screen where that
 * gap is the first thing visible, not a filter on a screen about something else.
 *
 * CASH LEADS. It is the only figure somebody has to physically produce at the end
 * of a shift; UPI and card arrive by themselves.
 *
 * IT SHOWS ITS OWN RECONCILIATION rather than claiming one. The same sales are
 * counted twice by two different paths — what staff recorded as taken, and the
 * payments the finance screens count — and the result is printed either way. A
 * screen that quietly agreed with itself would be worth nothing.
 */

const KIND_TONE = {
  rc: 'bg-good-50 text-good-700',
  declared: 'bg-watch-50 text-watch-700',
  no_plate: 'bg-wrong-50 text-wrong-700',
};

const METHOD_TONE = {
  cash: 'bg-watch-50 text-watch-700',
  upi: 'bg-brand-accent/10 text-brand-accent',
  card: 'bg-shell text-muted',
};

const KINDS = [['', 'All vehicles'], ['rc', 'Register identified'], ['declared', 'Type declared'], ['no_plate', 'No number plate']];
const METHODS = [['', 'All payments'], ['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']];

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function OnSpot() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [method, setMethod] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [head, setHead] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => { const id = setTimeout(() => setTerm(q.trim()), 250); return () => clearTimeout(id); }, [q]);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        api.onspotSummary({ from, to }),
        api.onspotSales({ from, to, method, kind, q: term, limit: 100 }),
      ]);
      setHead(s);
      setRows(l);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [from, to, method, kind, term]);

  useEffect(() => { load(); }, [load]);
  usePulse(load);

  const t = head?.totals;
  const rec = head?.reconcile;

  return (
    <Shell
      title="Gate sales"
      subtitle={t ? `${number(t.sales)} sold at the barrier · ${rupees(t.collected)} taken` : 'Loading…'}
    >
      {error && <Banner tone="wrong">{error}</Banner>}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-2xs text-muted">From
          <input type="date" className="input mt-1" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-2xs text-muted">To
          <input type="date" className="input mt-1" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input min-w-[200px] flex-1" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Plate, pass number, UPI reference or chassis number" />
      </div>

      {!head ? <Loading /> : (
        <>
          {/* Cash first: it is the only figure somebody must physically hand over. */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {head.byMethod.map((m) => (
              <div key={m.method} className={`card px-4 py-3 ${m.method === 'cash' ? 'ring-1 ring-watch-500/40' : ''}`}>
                <div className="text-2xs uppercase tracking-wide text-muted">{m.label}</div>
                <div className="mt-0.5 text-xl font-bold text-ink">{rupees(m.amount)}</div>
                <div className="text-2xs text-muted">{number(m.sales)} sale{m.sales === 1 ? '' : 's'}</div>
              </div>
            ))}
            <div className="card px-4 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted">Of which department</div>
              <div className="mt-0.5 text-xl font-bold text-ink">{rupees(t.department)}</div>
              <div className="text-2xs text-muted">fee {rupees(t.serviceFee)} · GST {rupees(t.gst)}</div>
            </div>
          </div>

          {/* The check, printed rather than assumed. */}
          {rec && (
            <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${rec.agrees && !rec.invoicesMissing
              ? 'border-good-500/30 bg-good-50 text-good-700'
              : 'border-wrong-500/30 bg-wrong-50 text-wrong-700'}`}>
              {rec.agrees && !rec.invoicesMissing ? (
                <>
                  <b>Agrees with the finance screens.</b> {number(rec.sales)} sale{rec.sales === 1 ? '' : 's'} recorded at
                  the gate ({rupees(rec.recorded)}) match {number(rec.payments)} counter payment{rec.payments === 1 ? '' : 's'} ({rupees(rec.banked)}),
                  with {number(rec.invoices)} tax invoice{rec.invoices === 1 ? '' : 's'} issued from the same series as online sales.
                </>
              ) : (
                <>
                  <b>These do not agree.</b> {number(rec.sales)} sale{rec.sales === 1 ? '' : 's'} worth {rupees(rec.recorded)} recorded
                  at the gate, against {number(rec.payments)} counter payment{rec.payments === 1 ? '' : 's'} worth {rupees(rec.banked)}
                  {rec.invoicesMissing > 0 ? `, and ${number(rec.invoicesMissing)} without a tax invoice` : ''}. Worth looking into before the day is closed.
                </>
              )}
            </div>
          )}

          {head.byStaff.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-[15px] font-semibold text-ink">Who took the money</h2>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-2xs uppercase tracking-wide text-muted">
                      <th className="th text-left">Staff</th>
                      <th className="th text-right">Sales</th>
                      <th className="th text-right">Cash to hand over</th>
                      <th className="th text-right">UPI</th>
                      <th className="th text-right">Card</th>
                      <th className="th text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {head.byStaff.map((s, i) => (
                      <tr key={i} className="border-b border-line/60 last:border-0">
                        <td className="td">
                          <div className="text-ink">{s.name}</div>
                          <div className="text-2xs text-muted">
                            {s.checkpost || '—'}{s.declared > 0 ? ` · ${number(s.declared)} type${s.declared === 1 ? '' : 's'} declared` : ''}
                          </div>
                        </td>
                        <td className="td tabular text-right">{number(s.sales)}</td>
                        <td className="td tabular text-right font-bold text-ink">{rupees(s.cash)}</td>
                        <td className="td tabular text-right">{rupees(s.upi)}</td>
                        <td className="td tabular text-right">{rupees(s.card)}</td>
                        <td className="td tabular text-right font-semibold text-ink">{rupees(s.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <h2 className="mb-2 text-[15px] font-semibold text-ink">
            Every sale{rows ? ` · ${number(rows.total)}` : ''}
          </h2>
          {!rows ? <Loading /> : rows.sales.length === 0 ? (
            <div className="card px-5 py-12 text-center text-sm text-muted">No pass was sold at a gate in this period.</div>
          ) : (
            <div className="card divide-y divide-line">
              {rows.sales.map((s) => (
                <div key={s.id}>
                  <button type="button" className="flex w-full items-start justify-between gap-3 px-5 py-3 text-left hover:bg-shell"
                    onClick={() => setOpen(open === s.id ? null : s.id)}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-ink">{s.kind === 'no_plate' ? s.regNo : plate(s.regNo)}</span>
                        <span className={`chip ${KIND_TONE[s.kind]}`}>{s.kindLabel}</span>
                        <span className={`chip ${METHOD_TONE[s.payment.method] || 'bg-shell text-muted'}`}>
                          {String(s.payment.method).toUpperCase()}
                        </span>
                        {s.photos.length > 0 && <span className="chip bg-shell text-muted">📷 {s.photos.length}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-2xs text-muted">
                        {s.ticketNo} · {s.type} · {s.slot} · sold by {s.soldBy || 'unknown'} at {when(s.soldAt)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tabular font-semibold text-ink">{rupees(s.payment.amount)}</div>
                      <div className="text-2xs text-muted">{s.entered ? 'entered' : 'not used'}</div>
                    </div>
                  </button>

                  {open === s.id && (
                    <div className="border-t border-line bg-shell px-5 py-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Group title="The money">
                          <Row k="Taken" v={`${rupees(s.payment.amount)} by ${String(s.payment.method).toUpperCase()}`} />
                          <Row k="Reference" v={s.payment.reference || (s.payment.method === 'cash' ? 'cash, no reference' : '—')} mono />
                          <Row k="Entry fee (Department)" v={rupees(s.payment.entry)} />
                          <Row k="Service fee (Pravesha)" v={rupees(s.payment.serviceFee)} />
                          <Row k="GST within the fee" v={rupees(s.payment.gst)} />
                          <Row k="Tax invoice" v={s.invoiceNo || 'not issued'} mono />
                        </Group>

                        <Group title="The vehicle">
                          <Row k="Number" v={s.regNo} mono />
                          <Row k="Type" v={`${s.type}${s.declaredByStaff ? ' — decided at the gate' : ' — from the register'}`} />
                          <Row k="Description" v={[s.vehicle, s.colour].filter(Boolean).join(' · ') || '—'} />
                          {s.identity && <Row k={`Identified by ${String(s.identity.kind).replace(/_/g, ' ')}`} v={s.identity.value} mono />}
                          <Row k="Visitor" v={`${s.visitor || 'no name'} · ${s.mobile}`} />
                        </Group>

                        <Group title="The gate">
                          <Row k="Sold by" v={s.soldBy || '—'} />
                          <Row k="Checkpost" v={s.checkpost || '—'} />
                          <Row k="Sold at" v={when(s.soldAt)} />
                          <Row k="For" v={`${dayLabel(s.travelDate)} · ${s.slot}`} />
                          <Row k="Entry" v={s.entered
                            ? `${when(s.entered.at)}${s.entered.source === 'self' ? ' · recorded by the visitor' : ''}`
                            : 'not used yet'} />
                        </Group>
                      </div>

                      {s.photos.length > 0 && <div className="mt-4"><Photos photos={s.photos} /></div>}

                      <button type="button" className="btn-quiet mt-4" onClick={() => navigate(`/tickets/${s.id}`)}>
                        Open the pass
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

const Group = ({ title, children }) => (
  <div>
    <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-muted">{title}</h3>
    <dl className="space-y-1">{children}</dl>
  </div>
);

const Row = ({ k, v, mono = false }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="shrink-0 text-2xs text-muted">{k}</dt>
    <dd className={`text-right text-sm text-ink ${mono ? 'font-mono text-2xs' : ''}`}>{v}</dd>
  </div>
);
