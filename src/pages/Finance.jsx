import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import Rolling from '../components/Rolling.jsx';
import { deliver } from '../lib/files';
import { useSession, can } from '../lib/session';
import { dayLabel, number, plate } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * My GST & Invoices — what Pravesha earned, what it owes in GST, what it spent,
 * and every invoice behind it.
 *
 * Money moved is counted by payment date; GST by invoice date. Each section
 * says which. The entry fee is the Tourism Department's and is shown, never
 * counted as Pravesha's revenue.
 */

const inr = (v, { paise = true } = {}) => {
  const x = Number(v || 0);
  return `${x < 0 ? '−' : ''}₹${Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: paise ? 2 : 0 })}`;
};

const PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['last7', '7 days'], ['thisMonth', 'This month'], ['prevMonth', 'Previous month'], ['custom', 'Custom'],
];

export default function Finance() {
  const { me } = useSession();
  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = preset === 'custom'
    ? (custom.from && custom.to ? { preset, from: custom.from, to: custom.to } : null)
    : { preset };
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    try { setData(await api.financeSummary(params)); setError(null); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const p = data?.period;
  const canRecord = can(me, 'finance.expenses');

  return (
    <Shell
      title="My GST & Invoices — Financial Management"
      subtitle={p ? `${dayLabel(p.from)}${p.to !== p.from ? ` – ${dayLabel(p.to)}` : ''}` : 'Service-fee revenue, GST, expenses, invoices and net earnings'}
    >
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
          <RevenueSummary data={data} />
          <GstCalculation data={data} canRecord={canRecord} onChanged={load} />
          <Expenses period={params} canRecord={canRecord} onChanged={load} />
          <Invoices period={params} />
        </div>
      )}
    </Shell>
  );
}

/* ─────────────────────────────────────────────── 8.1 revenue summary ── */

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

function Card({ label, value, sub, tone = 'text-ink', strong = false }) {
  return (
    <div className={`card p-4 ${strong ? 'border-brand/30 bg-brand/[0.03]' : ''}`}>
      <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular mt-1.5 text-2xl font-bold leading-none ${tone}`}><Rolling text={String(value)} /></div>
      {sub && <div className="mt-2 text-2xs text-muted">{sub}</div>}
    </div>
  );
}

function RevenueSummary({ data }) {
  const r = data.revenue;
  const g = data.gst;
  return (
    <Section title="Revenue summary" note={`By payment date · ${number(r.payments)} payments`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Gross collection" value={inr(r.grossCollection)} sub="Everything visitors paid" />
        <Card label="Tourism Department amount" value={inr(r.departmentAmount)} sub="Entry fees, passed on in full" />
        <Card label="Pravesha gross revenue" value={inr(r.praveshaGross)} sub="Service fee, GST included" />
        <Card label="GST" value={inr(r.gst)} sub={`${g.rate}% inside the service fee`} tone="text-watch-700" />
        <Card label="Gateway charges" value={inr(r.gatewayCharges)} sub={r.gatewayChargesKnown ? 'Razorpay fees, GST included' : 'Some payments have no fee recorded yet'} tone="text-watch-700" />
        <Card label="Refunds" value={inr(r.refunds)} sub={`${number(r.refundCount)} refunded`} tone={r.refunds ? 'text-wrong-700' : 'text-ink'} />
        <Card label="Net revenue" value={inr(r.netRevenue)} sub="Fee − GST − gateway − refunds" strong />
        <Card label="Take-home revenue" value={inr(r.takeHome)} sub={`After ${inr(r.expenses)} expenses and GST payable`} tone={r.takeHome < 0 ? 'text-wrong-700' : 'text-good-700'} strong />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Where the money went</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Flow label="Visitors paid" value={r.grossCollection} strong />
            <Flow label="Tourism Department (entry fees)" value={-r.departmentAmount} indent />
            <Flow label="Pravesha service fee" value={r.praveshaGross} strong />
            <Flow label="GST within the fee" value={-r.gst} indent />
            <Flow label="Payment gateway charges" value={-r.gatewayCharges} indent />
            {r.refunds > 0 && <Flow label="Refunded service fees (net of GST)" value={-(r.praveshaGross - r.gst - r.gatewayCharges - r.netRevenue)} indent />}
            <Flow label="Net revenue" value={r.netRevenue} strong />
            <Flow label="Expenses" value={-r.expenses} indent />
            {g.itc.claimed > 0 && <Flow label="GST saved by input tax credit" value={Math.round((r.takeHome - r.netRevenue + r.expenses) * 100) / 100} indent />}
            <Flow label="Take-home revenue" value={r.takeHome} strong good />
          </dl>
          <p className="mt-3 text-2xs text-muted">
            Settlement status is not shown yet: Razorpay settlement reports are not connected.
          </p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Day by day</h3>
          {data.daily.length < 2 ? (
            <p className="mt-6 text-center text-sm text-muted">Choose a longer period to see the trend.</p>
          ) : (
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e4eaea" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: '#6b7f80', fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                  <Tooltip labelFormatter={dayLabel} formatter={(v, k) => [inr(v), { service: 'Service fee', net: 'Net revenue', gst: 'GST' }[k] || k]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', fontSize: 13 }} />
                  <Area type="monotone" dataKey="service" stroke="#00a884" fill="#00a88422" strokeWidth={2} />
                  <Area type="monotone" dataKey="net" stroke="#075e54" fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="gst" stroke="#e08700" fill="none" strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Flow({ label, value, strong, indent, good }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${indent ? 'pl-4 text-body' : ''} ${strong ? 'border-t border-line pt-1.5 font-semibold text-ink' : ''}`}>
      <dt>{indent && <span className="mr-1.5 text-muted">↳</span>}{label}</dt>
      <dd className={`tabular ${good ? 'text-good-700' : ''}`}>{inr(value)}</dd>
    </div>
  );
}

/* ─────────────────────────────────────────────── 8.2 GST calculation ── */

function GstCalculation({ data, canRecord, onChanged }) {
  const g = data.gst;
  const [toggling, setToggling] = useState(false);

  const rows = [
    ['Revenue excluding GST', g.revenueExcludingGst, 'Service fee less the GST inside it (payment date)'],
    ['Taxable value', g.taxableValue, `On ${number(g.invoices)} invoices issued in the period`],
    [`Output GST (CGST ${inr(g.cgst)} + SGST ${inr(g.sgst)})`, g.outputGst, `${g.rate}% · intra-state, Karnataka`],
    ['Total invoice value', g.serviceInvoiceValue, `Taxable supply only. Invoices also show ${inr(g.pureAgentEntry)} of entry fees collected as pure agent (${inr(g.totalInvoiceValue)} in all).`],
  ];

  return (
    <Section title="GST calculation" note="By invoice date · an estimate to support your return, not a filing">
      {g.paidWithoutInvoice > 0 && (
        <Banner tone="watch" className="mb-3">{number(g.paidWithoutInvoice)} paid pass{g.paidWithoutInvoice === 1 ? ' has' : 'es have'} no invoice in this period.</Banner>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-line">
              {rows.map(([label, value, note]) => (
                <tr key={label}>
                  <td className="td"><div className="text-ink">{label}</div><div className="text-2xs text-muted">{note}</div></td>
                  <td className="td tabular text-right font-semibold text-ink">{inr(value)}</td>
                </tr>
              ))}
              {g.refundedGst > 0 && (
                <tr><td className="td text-ink">Less GST on refunds</td><td className="td tabular text-right text-wrong-700">{inr(-g.refundedGst)}</td></tr>
              )}
              <tr>
                <td className="td">
                  <div className="text-ink">Input tax credit on expenses</div>
                  <div className="text-2xs text-muted">{number(g.itc.expenseBills)} bill{g.itc.expenseBills === 1 ? '' : 's'} marked eligible, with vendor GSTIN and bill number</div>
                </td>
                <td className="td tabular text-right text-good-700">{inr(-g.itc.expenses)}</td>
              </tr>
              <tr>
                <td className="td">
                  <div className="flex flex-wrap items-center gap-2 text-ink">
                    GST inside gateway charges
                    <span className={`chip ${g.itc.includeGateway ? 'bg-good-50 text-good-700' : 'bg-shell text-muted'}`}>{g.itc.includeGateway ? 'Counted as ITC' : 'Not counted'}</span>
                  </div>
                  <div className="text-2xs text-muted">Claimable only against Razorpay’s tax invoice for the month</div>
                </td>
                <td className="td text-right">
                  <div className={`tabular ${g.itc.includeGateway ? 'text-good-700' : 'text-muted line-through'}`}>{inr(-g.itc.gatewayGst)}</div>
                  {canRecord && <button type="button" className="mt-1 text-2xs font-semibold text-brand hover:underline" onClick={() => setToggling(true)}>{g.itc.includeGateway ? 'Stop counting' : 'Count it'}</button>}
                </td>
              </tr>
            </tbody>
            <tfoot className="border-t border-line bg-shell">
              <tr>
                <td className="td font-semibold text-ink">GST payable (estimate)</td>
                <td className="td tabular text-right text-lg font-bold text-ink">{inr(g.payable)}</td>
              </tr>
              {g.excessItc > 0 && (
                <tr><td className="td text-ink">Excess credit to carry forward</td><td className="td tabular text-right text-good-700">{inr(g.excessItc)}</td></tr>
              )}
            </tfoot>
          </table>
        </div>
        <div className="card space-y-3 p-5 text-sm text-body">
          <h3 className="text-sm font-semibold text-ink">How it is worked out</h3>
          <p>The service fee includes GST. Taxable value = fee × 100 ÷ {100 + g.rate}; GST is the rest, split equally as CGST and SGST.</p>
          <p>The entry fee is collected for the Department of Tourism as a pure agent and is not part of Pravesha’s taxable value.</p>
          <p>Input tax credit counts only what is recorded here as eligible. Whether it can be claimed depends on the supplier’s invoice appearing in your GSTR-2B — confirm with your accountant before filing.</p>
          {g.testInvoices > 0 && <p className="text-2xs text-watch-700">{number(g.testInvoices)} of these invoices are test data (TST/ series).</p>}
        </div>
      </div>
      {toggling && (
        <ReasonDialog title={g.itc.includeGateway ? 'Stop counting gateway GST as ITC' : 'Count gateway GST as ITC'}
          text={g.itc.includeGateway ? 'GST inside gateway charges will no longer reduce GST payable.' : 'GST inside Razorpay’s charges will reduce GST payable. Only do this if you hold Razorpay’s tax invoices and they appear in GSTR-2B.'}
          action="Save" onClose={() => setToggling(false)}
          submit={(reason) => api.setGatewayItc(!g.itc.includeGateway, reason)}
          onDone={() => { setToggling(false); onChanged(); }} />
      )}
    </Section>
  );
}

function ReasonDialog({ title, text, action, submit, onDone, onClose, danger }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title={title} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={danger ? 'btn bg-wrong-500 text-white hover:bg-wrong-700' : 'btn-primary'} disabled={busy || !reasonOk(reason)}
          onClick={async () => { if (await run(() => submit(reason))) onDone(); }}>{busy ? 'Saving…' : action}</button>
      </>}>
      <p className="text-sm text-body">{text}</p>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────── expenses ── */

function Expenses({ period, canRecord, onChanged }) {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const key = JSON.stringify(period);

  const load = useCallback(() => api.expenses(period).then(setData).catch(() => setData({ expenses: [], categories: [] })), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const changed = () => { setAdding(false); setRemoving(null); load(); onChanged(); };
  const total = (data?.expenses || []).reduce((a, e) => a + e.amount, 0);

  return (
    <Section title="Expenses" note="By bill date · what running Pravesha cost in this period"
      actions={canRecord && <button type="button" className="btn-primary" onClick={() => setAdding(true)}>Record expense</button>}>
      <div className="card overflow-x-auto">
        {!data ? <div className="h-24 animate-pulse" /> : data.expenses.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No expenses recorded for this period.</p>
        ) : (
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-line bg-shell">
              <tr><th className="th">Date</th><th className="th">Category</th><th className="th">Vendor · bill</th><th className="th text-right">Amount</th><th className="th text-right">GST</th><th className="th">ITC</th><th className="th">Recorded by</th>{canRecord && <th className="th" />}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="td whitespace-nowrap text-sm">{dayLabel(e.spentOn)}</td>
                  <td className="td"><div className="text-sm text-ink">{e.category}</div>{e.description && <div className="text-2xs text-muted">{e.description}</div>}</td>
                  <td className="td text-sm">{e.vendor || '—'}{e.billRef && <div className="font-mono text-2xs text-muted">{e.billRef}{e.vendorGstin ? ` · ${e.vendorGstin}` : ''}</div>}</td>
                  <td className="td tabular text-right text-ink">{inr(e.amount)}</td>
                  <td className="td tabular text-right">{inr(e.gst)}</td>
                  <td className="td">{e.itcEligible ? <span className="chip bg-good-50 text-good-700">Eligible</span> : <span className="text-2xs text-muted">—</span>}</td>
                  <td className="td text-2xs text-muted">{e.createdBy}<div>{when(e.createdAt)}</div></td>
                  {canRecord && <td className="td text-right"><button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs text-wrong-700" onClick={() => setRemoving(e)}>Remove</button></td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-shell text-sm font-semibold text-ink">
              <tr><td className="td" colSpan={3}>Total</td><td className="td tabular text-right">{inr(total)}</td><td className="td tabular text-right">{inr(data.expenses.reduce((a, e) => a + e.gst, 0))}</td><td className="td" colSpan={canRecord ? 3 : 2} /></tr>
            </tfoot>
          </table>
        )}
      </div>
      {adding && <ExpenseForm categories={data?.categories || []} onClose={() => setAdding(false)} onSaved={changed} />}
      {removing && (
        <ReasonDialog title="Remove expense" danger action="Remove"
          text={`${removing.category} · ${inr(removing.amount)} on ${dayLabel(removing.spentOn)}. It stops counting in totals; the audit log keeps what it was.`}
          onClose={() => setRemoving(null)} submit={(reason) => api.removeExpense(removing.id, reason)} onDone={changed} />
      )}
    </Section>
  );
}

function ExpenseForm({ categories, onClose, onSaved }) {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const [f, setF] = useState({ spentOn: today, category: '', vendor: '', vendorGstin: '', billRef: '', description: '', amount: '', gst: '', itcEligible: false });
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const gstinOk = !f.vendorGstin || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(f.vendorGstin.toUpperCase());
  const itcReady = !f.itcEligible || (Number(f.gst) > 0 && f.vendorGstin && gstinOk && f.billRef.trim());

  return (
    <Modal title="Record an expense" subtitle="Enter the bill as it was paid, GST included" onClose={onClose} busy={busy} wide
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy || !f.category || !(Number(f.amount) > 0) || !gstinOk || !itcReady}
          onClick={async () => { if (await run(() => api.addExpense({ ...f, vendorGstin: f.vendorGstin.toUpperCase() }))) onSaved(); }}>
          {busy ? 'Saving…' : 'Record expense'}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bill date"><input type="date" className="input" max={today} value={f.spentOn} onChange={set('spentOn')} /></Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Bill total (₹)" hint="Including GST"><input type="number" min="0" step="0.01" className="input tabular" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="GST on the bill (₹)" hint="0 if the bill has no GST"><input type="number" min="0" step="0.01" className="input tabular" value={f.gst} onChange={set('gst')} /></Field>
        <Field label="Vendor"><input className="input" value={f.vendor} onChange={set('vendor')} /></Field>
        <Field label="Vendor GSTIN" hint={gstinOk ? undefined : 'Not a valid GSTIN'}><input className="input font-mono uppercase" maxLength={15} value={f.vendorGstin} onChange={set('vendorGstin')} /></Field>
        <Field label="Bill number"><input className="input font-mono" value={f.billRef} onChange={set('billRef')} /></Field>
        <Field label="Description"><input className="input" value={f.description} maxLength={500} onChange={set('description')} /></Field>
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm text-ink">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={f.itcEligible} onChange={set('itcEligible')} />
        <span>
          Eligible for input tax credit
          <span className="block text-2xs text-muted">Needs the GST amount, the vendor’s GSTIN and the bill number. Only tick it for a business expense on a proper tax invoice.</span>
        </span>
      </label>
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

/* ──────────────────────────────────────────── 8.3 search, 8.5 invoices ── */

function Invoices({ period }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [allDates, setAllDates] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const size = 25;

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  /* A new period starts from its newest invoices. */
  const periodKey = JSON.stringify(period);
  useEffect(() => { setPage(0); }, [periodKey]);
  const key = JSON.stringify([period, term, status, allDates, page]);

  useEffect(() => {
    let alive = true;
    const range = allDates ? {} : period;
    api.financeInvoices({ ...range, q: term, status, limit: size, offset: page * size })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function file(inv, action) {
    setBusy(`${inv.id}:${action}`);
    try { deliver(await api.invoiceFile(inv.id), action); } catch (e) { setError(e.message); } finally { setBusy(null); }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <Section title="Invoices" note={allDates ? 'All dates · newest first' : 'Issued in the selected period · newest first'}>
      <div className="card mb-3 grid gap-3 p-4 lg:grid-cols-[2fr_auto_auto]">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by mobile, vehicle number, pass number, invoice number, visitor name or payment ID" />
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
          <option value="">All statuses</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-brand" checked={allDates} onChange={(e) => { setAllDates(e.target.checked); setPage(0); }} />
          Search all dates
        </label>
      </div>

      {error && <Banner tone="wrong" className="mb-3">{error}</Banner>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1040px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Invoice</th><th className="th">Date</th><th className="th">Visitor</th><th className="th">Vehicle</th><th className="th">Ticket</th>
              <th className="th text-right">Amount</th><th className="th text-right">GST</th><th className="th">Status</th><th className="th text-right">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!data && <tr><td colSpan={9} className="h-24 animate-pulse" /></tr>}
            {data?.invoices.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">No invoices match.</td></tr>}
            {data?.invoices.map((i) => (
              <tr key={i.id} className="hover:bg-shell/40">
                <td className="td whitespace-nowrap font-mono text-sm text-ink">{i.invoiceNo}{i.test && <span className="chip ml-1.5 bg-watch-50 text-watch-700">Test</span>}</td>
                <td className="td whitespace-nowrap text-2xs text-muted">{when(i.issuedAt)}</td>
                <td className="td"><div className="text-sm text-ink">{i.visitor || '—'}</div><div className="text-2xs text-muted">{i.mobile}</div></td>
                <td className="td"><div className="font-mono text-sm">{plate(i.regNo)}</div><div className="text-2xs text-muted">{i.vehicleType}</div></td>
                <td className="td"><div className="font-mono text-sm">{i.ticketNo}</div><div className="text-2xs text-muted">visit {dayLabel(i.travelDate)}</div></td>
                <td className="td tabular text-right"><div className="font-semibold text-ink">{inr(i.amount)}</div><div className="text-2xs text-muted">fee {inr(i.serviceFee)}</div></td>
                <td className="td tabular text-right">{inr(i.gst)}</td>
                <td className="td">{i.status === 'refunded' ? <span className="chip bg-wrong-50 text-wrong-700">Refunded</span> : <span className="chip bg-good-50 text-good-700">Paid</span>}</td>
                <td className="td">
                  <div className="flex justify-end gap-1">
                    {[['open', 'View'], ['save', 'PDF'], ['print', 'Print']].map(([action, label]) => (
                      <button key={action} type="button" className="btn-quiet !px-2 !py-1 text-2xs" disabled={Boolean(busy)} onClick={() => file(i, action)}>
                        {busy === `${i.id}:${action}` ? '…' : label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
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
