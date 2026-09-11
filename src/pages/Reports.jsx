import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend as RLegend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { dayLabel, number, rupees } from '../lib/format';

/*
 * Reports — operational and financial reports for a day, a week, a month or any
 * period.
 *
 * WHAT IS ON SCREEN IS WHAT GETS PRINTED. The preview, the PDF, the Excel
 * workbook and the CSV are generated from one dataset on the server, so the
 * figure somebody reads here is the figure on the page they hand over.
 *
 * LOOKING IS NOT ISSUING. The preview is free and unrecorded; a download is a
 * report, so it gets a Report ID, goes in the register below, and is written to
 * the audit trail.
 *
 * TWO BASES, LABELLED. Operations are by travel date; money is by payment date,
 * the basis that reconciles with the bank.
 */

const KINDS = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['custom', 'Custom'],
];

const VEHICLE_ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };
const TOOLTIP = { borderRadius: 10, border: '1px solid #e4eaea', boxShadow: '0 12px 32px rgba(15,26,28,.12)', fontSize: 13 };

export default function Reports() {
  const [kind, setKind] = useState('daily');
  const [date, setDate] = useState('');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [history, setHistory] = useState([]);

  const params = useMemo(() => {
    if (kind === 'custom') return custom.from && custom.to ? { kind, from: custom.from, to: custom.to } : null;
    return date ? { kind, date } : { kind };
  }, [kind, date, custom]);

  const load = useCallback(async () => {
    if (!params) return;
    setLoading(true);
    try {
      setReport(await api.report(params));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const loadHistory = useCallback(() => api.reportHistory().then((d) => setHistory(d.reports)).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const today = report?.period?.today || new Date().toISOString().slice(0, 10);

  /** Fetch a report file with the session, then save, open or print it. */
  async function obtain(format, action) {
    if (!params) return;
    setBusy(`${format}:${action}`);
    setNotice(null);
    try {
      const { blob, filename, reportNo } = await api.reportFile(params, format);
      const url = URL.createObjectURL(blob);

      if (action === 'open') {
        window.open(url, '_blank', 'noopener');
      } else if (action === 'print') {
        /* A hidden frame holding the PDF, printed once it has loaded. */
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        frame.src = url;
        frame.onload = () => {
          try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(url, '_blank', 'noopener'); }
        };
        document.body.appendChild(frame);
        setTimeout(() => frame.remove(), 60000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice(`${reportNo} generated.`);
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const p = report?.period;

  return (
    <Shell
      title="Reports — operational and financial reports"
      subtitle={p ? `${dayLabel(p.from)}${p.to !== p.from ? ` – ${dayLabel(p.to)}` : ''} · ${p.days} day${p.days === 1 ? '' : 's'}${p.partial ? ' · to date' : ''}` : 'Daily, weekly, monthly and custom-period reports'}
    >
      {/* Controls */}
      <div className="card mb-5 flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="label">Report</div>
            <div className="flex gap-1 rounded-lg border border-line bg-white p-1">
              {KINDS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => setKind(key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${kind === key ? 'bg-brand text-white' : 'text-body hover:bg-shell'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {kind !== 'custom' ? (
            <div>
              <div className="label">{kind === 'daily' ? 'Date' : kind === 'weekly' ? 'Any day in the week' : 'Any day in the month'}</div>
              <input type="date" className="input !w-auto !py-2" max={today} value={date || p?.to || ''}
                onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <div>
              <div className="label">From – to</div>
              <div className="flex items-center gap-1.5">
                <input type="date" className="input !w-auto !py-2" max={today} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                <span className="text-muted">–</span>
                <input type="date" className="input !w-auto !py-2" max={today} min={custom.from || undefined} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!report || busy} onClick={() => obtain('pdf', 'open')}>
            {busy === 'pdf:open' ? 'Generating…' : 'Generate PDF'}
          </button>
          <button type="button" className="btn-quiet" disabled={!report || busy} onClick={() => obtain('pdf', 'save')}>
            {busy === 'pdf:save' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button type="button" className="btn-quiet" disabled={!report || busy} onClick={() => obtain('pdf', 'print')}>
            {busy === 'pdf:print' ? 'Preparing…' : 'Print'}
          </button>
          <button type="button" className="btn-quiet" disabled={!report || busy} onClick={() => obtain('xlsx', 'save')}
            title="Excel workbook: one sheet per section, with filters and live totals">
            {busy === 'xlsx:save' ? 'Preparing…' : 'Export Excel'}
          </button>
          <button type="button" className="btn-quiet" disabled={!report || busy} onClick={() => obtain('csv', 'save')}
            title="A single flat file, for other tools">
            {busy === 'csv:save' ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {notice && <div className="mb-4 rounded-lg border border-good-500/25 bg-good-50 px-4 py-2.5 text-sm font-medium text-good-700">{notice} It is in the register below.</div>}
      {error && <div className="mb-4 rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-2.5 text-sm font-medium text-wrong-700">{error}</div>}
      {kind === 'custom' && !params && <p className="card mb-4 px-4 py-10 text-center text-sm text-muted">Choose a start and end date.</p>}
      {loading && !report && <div className="card h-80 animate-pulse" />}

      {report && (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <Summary report={report} />
          {report.period.kind === 'daily' ? <DailyDetail report={report} /> : <PeriodDetail report={report} />}
          <Finance report={report} />
          <RevenueGraphs report={report} />
          <Operations report={report} />
          <Register rows={history} />
        </div>
      )}
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────── pieces ── */

const Section = ({ title, note, children }) => (
  <section>
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {note && <span className="text-2xs text-muted">{note}</span>}
    </div>
    {children}
  </section>
);

const Card = ({ title, note, children, className = '' }) => (
  <div className={`card overflow-hidden ${className}`}>
    {title && (
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {note && <span className="text-2xs text-muted">{note}</span>}
      </div>
    )}
    {children}
  </div>
);

const Figure = ({ label, value, sub, tone = 'text-ink' }) => (
  <div className="card p-4">
    <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
    <div className={`tabular mt-1.5 text-2xl font-bold leading-none ${tone}`}>{value}</div>
    {sub && <div className="mt-1.5 text-2xs text-muted">{sub}</div>}
  </div>
);

const pc = (n) => `${Number(n || 0).toFixed(1)}%`;

function Summary({ report }) {
  const s = report.summary;
  const f = report.finance;
  return (
    <Section title="Executive summary" note="Operations by travel date · money by payment date">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Figure label="Total bookings" value={number(s.bookings)} sub={`${pc(s.occupancy)} of capacity`} />
        <Figure label="Total entries" value={number(s.entries)} sub={`${pc(s.showUpRate)} of bookings`} />
        <Figure label="Yet to arrive" value={number(s.yetToArrive)} sub="slot still open" />
        <Figure label="Skipped" value={number(s.skipped)} sub={`${pc(s.noShowRate)} no-show`} tone="text-watch-700" />
        <Figure label="Invalid" value={number(s.invalid)} sub={`${pc(s.invalidRate)} of look-ups`} tone="text-wrong-700" />
        <Figure label="Duplicate" value={number(s.duplicate)} sub={`${pc(s.duplicateRate)} of look-ups`} tone="text-wrong-700" />
        <Figure label="Visitors" value={number(s.visitors)} sub={`${number(report.visitors.new)} new · ${number(report.visitors.returning)} returning`} />
        <Figure label="Collected" value={rupees(f.collected)} sub={`${number(f.payments)} payments`} />
        <Figure label="Department" value={rupees(f.department)} sub="entry fees" />
        <Figure label="Service fee" value={rupees(f.serviceFee)} sub={`${f.serviceFeePercent}% · includes GST`} />
        <Figure label="GST" value={rupees(f.gst)} sub={`${f.gstPercent}% within the fee`} />
        <Figure label="Refunds" value={rupees(f.refunds)} sub={`${number(f.refundCount)} refunded`} />
      </div>
      <p className="mt-3 text-2xs text-muted">
        Cancellations are not reported: a visitor cannot cancel a pass in the product, so the figure could only be zero.
      </p>
    </Section>
  );
}

/** Daily: vehicles, slots and staff for the one day. */
function DailyDetail({ report }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <VehicleTable report={report} />
      <SlotTable report={report} />
      <div className="xl:col-span-2"><StaffTable report={report} /></div>
    </div>
  );
}

/** Weekly and longer: the day table, the peaks, and — for a month — the extra graphs. */
function PeriodDetail({ report }) {
  const monthlyish = report.period.days >= 14 || report.period.kind === 'monthly';
  const cap = report.summary.dailyCapacity;
  const occupancy = report.daily.map((d) => ({ day: d.day, occupancy: cap ? Math.round((d.bookings / cap) * 1000) / 10 : 0 }));

  return (
    <div className="space-y-6">
      <Section title="Day by day" note="Totals below include every day in the period">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-line bg-shell">
              <tr>
                <th className="th">Day</th><th className="th text-right">Bookings</th><th className="th text-right">Entries</th>
                <th className="th text-right">🏍️ Bikes</th><th className="th text-right">🚗 Cars</th><th className="th text-right">🚙 Toofan</th>
                <th className="th text-right">🚐 TT</th><th className="th text-right">Skipped</th><th className="th text-right">Invalid</th>
                <th className="th text-right">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.daily.map((d) => (
                <tr key={d.day} className="hover:bg-shell/60">
                  <td className="td whitespace-nowrap text-ink">{dayLabel(d.day)}</td>
                  <td className="td tabular text-right">{number(d.bookings)}</td>
                  <td className="td tabular text-right font-semibold text-ink">{number(d.entries)}</td>
                  <td className="td tabular text-right text-muted">{number(d.bikes)}</td>
                  <td className="td tabular text-right text-muted">{number(d.cars)}</td>
                  <td className="td tabular text-right text-muted">{number(d.toofans)}</td>
                  <td className="td tabular text-right text-muted">{number(d.tts)}</td>
                  <td className="td tabular text-right text-watch-700">{number(d.skipped)}</td>
                  <td className="td tabular text-right text-wrong-700">{number(d.invalid)}</td>
                  <td className="td tabular text-right text-ink">{rupees(d.collected)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-shell text-sm font-semibold text-ink">
              <tr>
                <td className="td">Total</td>
                {['bookings', 'entries', 'bikes', 'cars', 'toofans', 'tts', 'skipped', 'invalid'].map((k) => (
                  <td key={k} className="td tabular text-right">{number(report.daily.reduce((a, d) => a + d[k], 0))}</td>
                ))}
                <td className="td tabular text-right">{rupees(report.daily.reduce((a, d) => a + d.collected, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Figure label="Highest traffic day" value={report.peaks.highestDay ? number(report.peaks.highestDay.entries) : '—'} sub={report.peaks.highestDay && dayLabel(report.peaks.highestDay.day)} />
        <Figure label="Lowest traffic day" value={report.peaks.lowestDay ? number(report.peaks.lowestDay.entries) : '—'} sub={report.peaks.lowestDay && dayLabel(report.peaks.lowestDay.day)} />
        <Figure label="Peak hour" value={report.peaks.peakHour ? report.peaks.peakHour.label : '—'} sub={report.peaks.peakHour && `${number(report.peaks.peakHour.entries)} entries`} />
        <Figure label="Total revenue" value={rupees(report.finance.collected)} sub="collected" />
        <Figure label="Pravesha fee" value={rupees(report.finance.serviceFee)} sub={`net ${rupees(report.finance.netPravesha)}`} />
        <Figure label="Department" value={rupees(report.finance.department)} sub="entry fees collected" />
      </div>

      {monthlyish && (
        <Section title="Trends" note="Day-wise, week-wise, by vehicle, occupancy">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Entries by day">
              <Chart><AreaChart data={report.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} labelFormatter={dayLabel} />
                <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#9fb0aa" fill="none" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="entries" name="Entries" stroke="#00a884" strokeWidth={2} fill="#00a88422" />
              </AreaChart></Chart>
            </Card>
            <Card title="Entries by week" note="Weeks start on Monday">
              <Chart><BarChart data={report.weekly} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w) => dayLabel(w).split(',')[1]} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} labelFormatter={(w) => `Week of ${dayLabel(w)}`} />
                <Bar dataKey="entries" name="Entries" fill="#075e54" radius={[4, 4, 0, 0]} />
              </BarChart></Chart>
            </Card>
            <Card title="Entries by vehicle type">
              <Chart><BarChart data={report.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} labelFormatter={dayLabel} />
                <RLegend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="bikes" name="Bike" stackId="v" fill="#00a884" />
                <Bar dataKey="cars" name="Car" stackId="v" fill="#075e54" />
                <Bar dataKey="toofans" name="Toofan" stackId="v" fill="#e08700" />
                <Bar dataKey="tts" name="TT" stackId="v" fill="#6b7f80" />
              </BarChart></Chart>
            </Card>
            <Card title="Occupancy by day" note={`Bookings against ${number(cap)} places a day`}>
              <Chart><LineChart data={occupancy} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} unit="%" tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} labelFormatter={dayLabel} formatter={(v) => [`${v}%`, 'Occupancy']} />
                <Line type="monotone" dataKey="occupancy" stroke="#128c7e" strokeWidth={2} dot={false} />
              </LineChart></Chart>
            </Card>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Figure label="Visitor growth" value={report.visitors.growth === null ? '—' : `${report.visitors.growth > 0 ? '+' : ''}${report.visitors.growth}%`}
              sub={`${number(report.visitors.total)} vs ${number(report.visitors.previousPeriod)} the period before`}
              tone={report.visitors.growth === null ? 'text-ink' : report.visitors.growth >= 0 ? 'text-good-700' : 'text-wrong-700'} />
            <Figure label="Repeat visitors" value={pc(report.visitors.returningShare)} sub={`${number(report.visitors.returning)} had been before`} />
            <Figure label="Invalid attempt rate" value={pc(report.summary.invalidRate)} sub={`${number(report.summary.invalid)} of ${number(report.summary.lookups)} look-ups`} tone="text-wrong-700" />
            <Figure label="Cancellation rate" value="—" sub="Cancellation is not offered in the product" />
          </div>
        </Section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <VehicleTable report={report} />
        <SlotTable report={report} />
        <div className="xl:col-span-2"><StaffTable report={report} /></div>
      </div>
    </div>
  );
}

const Chart = ({ children }) => (
  <div className="h-60 px-2 pb-2 pt-3"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
);

function VehicleTable({ report }) {
  return (
    <Card title="Vehicle breakdown" note="By travel date">
      <table className="w-full">
        <thead className="border-b border-line bg-shell">
          <tr><th className="th">Type</th><th className="th text-right">Passes</th><th className="th text-right">Entries</th><th className="th text-right">Share</th><th className="th text-right">Pass value</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.vehicles.map((v) => (
            <tr key={v.code}>
              <td className="td text-ink"><span className="mr-1.5" aria-hidden>{VEHICLE_ICON[v.code]}</span>{v.label}</td>
              <td className="td tabular text-right">{number(v.passes)}</td>
              <td className="td tabular text-right font-semibold text-ink">{number(v.entries)}</td>
              <td className="td tabular text-right text-muted">{pc(v.shareOfEntries)}</td>
              <td className="td tabular text-right text-ink">{rupees(v.passValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SlotTable({ report }) {
  return (
    <Card title="Slot utilisation" note="Capacity across every day of the period">
      <table className="w-full">
        <thead className="border-b border-line bg-shell">
          <tr><th className="th">Slot</th><th className="th text-right">Capacity</th><th className="th text-right">Booked</th><th className="th text-right">Entered</th><th className="th text-right">Occupancy</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.slots.map((s) => (
            <tr key={s.label}>
              <td className="td text-ink">{s.label}</td>
              <td className="td tabular text-right text-muted">{number(s.capacity)}</td>
              <td className="td tabular text-right">{number(s.booked)}</td>
              <td className="td tabular text-right">{number(s.entered)}</td>
              <td className="td text-right">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-shell"><span className="block h-full rounded-full bg-brand-accent" style={{ width: `${Math.min(100, s.occupancy)}%` }} /></span>
                  <span className="tabular w-11 text-right text-sm">{pc(s.occupancy)}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StaffTable({ report }) {
  return (
    <Card title="Staff activity" note="Check time measured by the gate app">
      {report.staff.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No gate checks in this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-line bg-shell">
              <tr><th className="th">Staff</th><th className="th text-right">Checks</th><th className="th text-right">Valid</th><th className="th text-right">Invalid</th><th className="th text-right">Duplicate</th><th className="th text-right">Admitted outside slot</th><th className="th text-right">Average</th><th className="th">Peak hour</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.staff.map((s) => (
                <tr key={s.id}>
                  <td className="td font-medium text-ink">{s.name}</td>
                  <td className="td tabular text-right">{number(s.checks)}</td>
                  <td className="td tabular text-right text-good-700">{number(s.valid)}</td>
                  <td className="td tabular text-right text-wrong-700">{number(s.invalid)}</td>
                  <td className="td tabular text-right text-wrong-700">{number(s.duplicate)}</td>
                  <td className="td tabular text-right text-watch-700">{number(s.admittedAnyway)}</td>
                  <td className="td tabular text-right">{s.averageMs === null ? '—' : `${(s.averageMs / 1000).toFixed(1)} sec`}</td>
                  <td className="td text-muted">{s.peakHour ? s.peakHour.label : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** 5.4 — where the money goes. */
function Finance({ report }) {
  const f = report.finance;
  const parts = [
    ['Tourism Department', f.department, '#075e54'],
    ['Pravesha net revenue', Math.max(0, f.netPravesha), '#00a884'],
    ['GST', f.gst, '#e08700'],
    ['Payment gateway charges', f.gateway || 0, '#6b7f80'],
  ];
  return (
    <Section title="Financial split" note="By payment date — reconciles with the bank">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Collection distribution">
          <div className="p-4">
            <div className="flex h-5 overflow-hidden rounded-full bg-shell">
              {parts.map(([label, value, colour]) => (
                <div key={label} title={`${label}: ${rupees(value)}`} style={{ width: `${f.collected ? (value / f.collected) * 100 : 0}%`, background: colour }} />
              ))}
            </div>
            <ol className="mt-5 space-y-0">
              <Flow label="Total collected from visitors" value={f.collected} strong />
              <Flow label="Tourism Department (entry fees)" value={f.department} indent share={f.collected} />
              <Flow label={`Pravesha service fee (${f.serviceFeePercent}%)`} value={f.serviceFee} indent share={f.collected} />
              <Flow label={`GST within the fee (${f.gstPercent}%)`} value={-f.gst} indent2 />
              <Flow label="Payment gateway charges" value={f.gateway === null ? null : -f.gateway} indent2 />
              <Flow label="Net Pravesha revenue" value={f.netPravesha} strong />
              <Flow label={`Refunds (${number(f.refundCount)})`} value={-f.refunds} />
              <Flow label="Collected after refunds" value={f.netCollected} />
            </ol>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 self-start">
          {parts.map(([label, value, colour]) => (
            <div key={label} className="card p-4">
              <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-muted">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colour }} />{label}
              </div>
              <div className="tabular mt-1.5 text-xl font-bold text-ink">{rupees(value)}</div>
              <div className="mt-1 text-2xs text-muted">{f.collected ? pc((value / f.collected) * 100) : '—'} of collection</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Flow({ label, value, strong, indent, indent2, share }) {
  return (
    <li className={`flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm ${strong ? 'font-semibold text-ink' : 'text-body'} ${indent ? 'pl-4' : ''} ${indent2 ? 'pl-8 text-muted' : ''}`}>
      <span>{indent || indent2 ? '↳ ' : ''}{label}</span>
      <span className="tabular">
        {value === null ? <span className="text-line" title="Not reported by the gateway for this period">not reported</span>
          : `${value < 0 ? '− ' : ''}${rupees(Math.abs(value))}`}
        {share ? <span className="ml-2 text-2xs text-muted">{pc((value / share) * 100)}</span> : null}
      </span>
    </li>
  );
}

/** 5.5 — selectable revenue graphs. */
function RevenueGraphs({ report }) {
  const [series, setSeries] = useState('collected');
  if (report.daily.length < 2) return null;

  const OPTIONS = [
    ['collected', 'Total collection', 'What visitors paid', '#075e54'],
    ['department', 'Tourism Department', 'Official ticket amount', '#128c7e'],
    ['serviceFee', 'Pravesha revenue', 'Service fee', '#00a884'],
    ['gst', 'GST', 'Within the service fee', '#e08700'],
    ['net', 'Net revenue', 'Fee less GST and gateway', '#0a6c34'],
    ['byVehicle', 'By vehicle', 'Pass value by type', '#6b7f80'],
  ];
  const data = report.daily.map((d) => ({ ...d, net: d.serviceFee - d.gst - d.gateway }));
  const chosen = OPTIONS.find((o) => o[0] === series);

  return (
    <Section title="Revenue graphs" note={series === 'byVehicle' ? 'By travel date' : 'By payment date'}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {OPTIONS.map(([key, label, hint]) => (
          <button key={key} type="button" onClick={() => setSeries(key)} title={hint}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${series === key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-body hover:bg-shell'}`}>
            {label}
          </button>
        ))}
      </div>
      <Card title={chosen[1]} note={chosen[2]}>
        <div className="h-72 px-2 pb-2 pt-3">
          <ResponsiveContainer width="100%" height="100%">
            {series === 'byVehicle' ? (
              <BarChart data={report.vehicles} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={52} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v, k) => [rupees(v), k]} />
                <RLegend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="department" name="Department" stackId="r" fill="#075e54" />
                <Bar dataKey="serviceFee" name="Pravesha fee" stackId="r" fill="#00a884" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => (Math.abs(v) >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} tickLine={false} axisLine={false} width={52} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} labelFormatter={dayLabel} formatter={(v) => [rupees(v), chosen[1]]} />
                <Area type="monotone" dataKey={series} stroke={chosen[3]} strokeWidth={2} fill={`${chosen[3]}22`} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>
    </Section>
  );
}

/** Negative activity, for the operations side of the report. */
function Operations({ report }) {
  const s = report.summary;
  return (
    <Section title="Invalid and negative activity">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Figure label="Skipped (no-show)" value={number(s.skipped)} sub={`${pc(s.noShowRate)} of bookings`} tone="text-watch-700" />
        <Figure label="Abandoned at payment" value={number(s.abandoned)} sub="place held, never paid" tone="text-watch-700" />
        <Figure label="Invalid passes" value={number(s.invalid)} sub="wrong day, gate, unpaid, unknown" tone="text-wrong-700" />
        <Figure label="Duplicate presentations" value={number(s.duplicate)} sub="same pass twice" tone="text-wrong-700" />
        <Figure label="Admitted outside slot" value={number(s.admittedAnyway)} sub="on a staff member's authority" tone="text-watch-700" />
      </div>
    </Section>
  );
}

function Register({ rows }) {
  return (
    <Section title="Report register" note="Every report downloaded, with its ID">
      <Card>
        {rows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No reports generated yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-line bg-shell">
                <tr><th className="th">Report ID</th><th className="th">Type</th><th className="th">Period</th><th className="th">Format</th><th className="th">Generated</th><th className="th">By</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.reportNo}>
                    <td className="td font-mono text-2xs text-ink">{r.reportNo}</td>
                    <td className="td capitalize text-body">{r.kind}</td>
                    <td className="td whitespace-nowrap text-muted">{r.from === r.to ? dayLabel(r.from) : `${dayLabel(r.from)} – ${dayLabel(r.to)}`}</td>
                    <td className="td uppercase text-muted">{r.format}</td>
                    <td className="td whitespace-nowrap text-muted">{new Date(r.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="td text-muted">{r.generatedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Section>
  );
}
