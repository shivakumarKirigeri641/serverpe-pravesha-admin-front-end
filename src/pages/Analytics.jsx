import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { clock, dayLabel, number, percent, plate, rupees, shiftDay } from '../lib/format';

/*
 * Data analytics — visitor and entry intelligence.
 *
 * Six views over history, each answering one kind of question: how much traffic
 * and when (Traffic), what each day looked like (Day-wise), how one period
 * compares with another (Compare), who comes back (Visitors), everything about
 * one vehicle (Vehicles), and how each staff member works (Staff).
 *
 * ONE RANGE FOR THE WHOLE SCREEN. Traffic, the day table and staff all read the
 * same dates, so switching tabs never silently changes what period is being
 * looked at. Compare has its own pair of ranges, because comparing is its point.
 *
 * NOTHING HERE IS LIVE. History does not change while somebody reads it, so the
 * screen loads once per range and does not poll.
 */

const TABS = [
  ['traffic', 'Traffic'],
  ['daily', 'Day-wise'],
  ['compare', 'Compare'],
  ['visitors', 'Visitors'],
  ['vehicles', 'Vehicles'],
  ['staff', 'Staff'],
];

const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7', '7 days'],
  ['30', '30 days'],
  ['custom', 'Custom'],
];

export default function Analytics() {
  const [tab, setTab] = useState('traffic');
  const [rangeKey, setRangeKey] = useState('30');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  /* The server's today, once known; until then the browser's is close enough to
     draw the controls, and the API clamps anything past today regardless. */
  const today = data?.today || new Date().toISOString().slice(0, 10);

  const range = useMemo(() => {
    switch (rangeKey) {
      case 'today': return { from: today, to: today };
      case 'yesterday': return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
      case '7': return { from: shiftDay(today, -6), to: today };
      case '30': return { from: shiftDay(today, -29), to: today };
      default: return custom.from && custom.to ? custom : null;
    }
  }, [rangeKey, custom, today]);

  const load = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    try {
      setData(await api.analytics(range));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [range?.from, range?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const usesRange = tab === 'traffic' || tab === 'daily' || tab === 'staff';

  return (
    <Shell
      title="Data analytics — visitor and entry intelligence"
      subtitle={data && usesRange ? `${dayLabel(data.from)} – ${dayLabel(data.to)}` : 'History across visitors, vehicles, traffic and staff'}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-1">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === key ? 'bg-brand text-white' : 'text-body hover:bg-shell'}`}>
              {label}
            </button>
          ))}
        </nav>

        {usesRange && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-line bg-white p-1">
              {RANGES.map(([key, label]) => (
                <button key={key} type="button" onClick={() => setRangeKey(key)}
                  className={`rounded-md px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider transition ${rangeKey === key ? 'bg-ink text-white' : 'text-muted hover:bg-shell'}`}>
                  {label}
                </button>
              ))}
            </div>
            {rangeKey === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input type="date" className="input !w-auto !py-1.5 text-[13px]" max={today} value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                <span className="text-muted">–</span>
                <input type="date" className="input !w-auto !py-1.5 text-[13px]" max={today} min={custom.from || undefined} value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm font-medium text-wrong-700">
          {error} <button type="button" className="ml-2 underline" onClick={load}>Retry</button>
        </div>
      )}

      {usesRange && rangeKey === 'custom' && !range && (
        <p className="card px-4 py-10 text-center text-sm text-muted">Choose a start and end date.</p>
      )}

      {usesRange && loading && !data && <div className="card h-72 animate-pulse" />}

      {tab === 'traffic' && data && <Traffic data={data} loading={loading} />}
      {tab === 'daily' && data && <Daily rows={data.daily} money={!data.financeHidden} />}
      {tab === 'staff' && data && <Staff rows={data.staff} />}
      {tab === 'compare' && <Compare today={today} />}
      {tab === 'visitors' && <Visitors bands={data?.visitors} />}
      {tab === 'vehicles' && <Vehicles />}
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────── shared bits ── */

const TOOLTIP = { borderRadius: 10, border: '1px solid #e4eaea', boxShadow: '0 12px 32px rgba(15,26,28,.12)', fontSize: 13 };
const VEHICLE_ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

const BAND = {
  first_time: ['First-time', 'bg-shell text-body'],
  occasional: ['Occasional', 'bg-brand/10 text-brand'],
  returning: ['Returning', 'bg-good-50 text-good-700'],
  frequent: ['Frequent', 'bg-brand text-white'],
};

const STATUS = {
  used: ['Entered', 'bg-good-50 text-good-700'],
  paid: ['Booked', 'bg-brand/10 text-brand'],
  expired: ['Abandoned', 'bg-shell text-muted'],
  held: ['Holding', 'bg-watch-50 text-watch-700'],
};

const Chip = ({ map, value }) => {
  const [label, tone] = map[value] || [value, 'bg-shell text-muted'];
  return <span className={`chip ${tone}`}>{label}</span>;
};

function secs(ms) {
  if (ms === null || ms === undefined) return '—';
  return ms < 60000 ? `${(ms / 1000).toFixed(1)} sec` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} sec`;
}

function Card({ title, note, children, className = '' }) {
  return (
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
}

function Figure({ label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular mt-1.5 text-2xl font-bold leading-none text-ink">{value}</div>
      {sub && <div className="mt-1.5 text-2xs text-muted">{sub}</div>}
    </div>
  );
}

function Delta({ stat, good = 'up' }) {
  const text = percent(stat.percent);
  if (stat.direction === 'flat') return <span className="chip bg-shell text-muted">no change</span>;
  if (text === null) return <span className="chip bg-brand/10 text-brand" title="Nothing to compare with">new</span>;
  const favourable = (stat.direction === 'up') === (good === 'up');
  return (
    <span className={`chip ${favourable ? 'bg-good-50 text-good-700' : 'bg-wrong-50 text-wrong-700'}`}>
      <span aria-hidden>{stat.direction === 'up' ? '▲' : '▼'}</span>{text}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────── traffic ── */

function Traffic({ data, loading }) {
  const t = data.traffic;
  const p = t.peak;
  return (
    <div className={`space-y-5 ${loading ? 'opacity-60' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Vehicles entered" value={number(t.vehicles)} sub={`${number(t.passes)} passes booked`} />
        <Figure label="Visitors" value={number(t.visitors)} sub={`${t.averages.perVisitor} visits each`} />
        <Figure label="Average per day" value={number(t.averages.perDay)} sub={`over ${t.days} day${t.days === 1 ? '' : 's'}`} />
        <Figure label="Average per hour" value={number(t.averages.perHour)} sub="across the 12 open hours" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {t.byCategory.map((c) => (
          <Figure key={c.code} label={<><span className="mr-1.5" aria-hidden>{VEHICLE_ICON[c.code]}</span>{c.label}</>}
            value={number(c.entered)}
            sub={t.vehicles ? `${Math.round((c.entered / t.vehicles) * 100)}% of vehicles` : '—'} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Entries by hour of day" note="Across the whole range">
          <div className="h-64 px-2 pb-2 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={t.hours} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e4eaea" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP} cursor={{ fill: '#f6f8f8' }} formatter={(v) => [number(v), 'Entries']} />
                <Bar dataKey="entries" fill="#00a884" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Peaks" note="Highest and lowest in the range">
          <ul className="divide-y divide-line text-sm">
            <PeakRow label="Busiest day" hi={p.busiestDay && `${dayLabel(p.busiestDay.day)} · ${number(p.busiestDay.entered)}`}
              lo={p.quietestDay && `${dayLabel(p.quietestDay.day)} · ${number(p.quietestDay.entered)}`} loLabel="Quietest day" />
            <PeakRow label="Peak hour" hi={p.busiestHour && `${p.busiestHour.label} · ${number(p.busiestHour.entries)}`}
              lo={p.quietestHour && `${p.quietestHour.label} · ${number(p.quietestHour.entries)}`} loLabel="Quietest hour" />
            <PeakRow label="Busiest slot" hi={p.busiestSlot && `${p.busiestSlot.label} · ${number(p.busiestSlot.entered)}`}
              lo={p.quietestSlot && `${p.quietestSlot.label} · ${number(p.quietestSlot.entered)}`} loLabel="Quietest slot" />
            <PeakRow label="Most common vehicle" hi={p.topCategory && `${p.topCategory.label} · ${number(p.topCategory.entered)}`}
              lo={p.bottomCategory && `${p.bottomCategory.label} · ${number(p.bottomCategory.entered)}`} loLabel="Least common" />
          </ul>
        </Card>
      </div>

      <Card title="Vehicles per day" note="Entries recorded">
        <div className="h-56 px-2 pb-2 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[...data.daily].reverse()} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#075e54" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#075e54" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e4eaea" vertical={false} />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP} labelFormatter={dayLabel} formatter={(v) => [number(v), 'Vehicles']} />
              <Area type="monotone" dataKey="vehicles" stroke="#075e54" strokeWidth={2} fill="url(#gDaily)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function PeakRow({ label, hi, loLabel, lo }) {
  return (
    <li className="grid grid-cols-2 gap-3 px-4 py-3">
      <div>
        <div className="text-2xs font-semibold uppercase tracking-wider text-good-700">{label}</div>
        <div className="mt-0.5 text-ink">{hi || '—'}</div>
      </div>
      <div>
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{loLabel}</div>
        <div className="mt-0.5 text-body">{lo || '—'}</div>
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────── day-wise ── */

function Daily({ rows, money = true }) {
  const totals = rows.reduce((a, r) => ({
    visitors: a.visitors + r.visitors, vehicles: a.vehicles + r.vehicles, bikes: a.bikes + r.bikes,
    cars: a.cars + r.cars, toofans: a.toofans + r.toofans, tts: a.tts + r.tts, revenue: a.revenue + r.revenue,
  }), { visitors: 0, vehicles: 0, bikes: 0, cars: 0, toofans: 0, tts: 0, revenue: 0 });

  return (
    <Card title="Day by day" note={money ? 'Newest first · revenue is the value of passes for that date' : 'Newest first'}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Date</th><th className="th text-right">Visitors</th><th className="th text-right">Vehicles</th>
              <th className="th text-right">🏍️ Bikes</th><th className="th text-right">🚗 Cars</th>
              <th className="th text-right">🚙 Toofan</th><th className="th text-right">🚐 TT</th>{money && <th className="th text-right">Revenue</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.day} className="hover:bg-shell/60">
                <td className="td whitespace-nowrap text-ink">{dayLabel(r.day)}</td>
                <td className="td tabular text-right">{number(r.visitors)}</td>
                <td className="td tabular text-right font-semibold text-ink">{number(r.vehicles)}</td>
                <td className="td tabular text-right text-muted">{number(r.bikes)}</td>
                <td className="td tabular text-right text-muted">{number(r.cars)}</td>
                <td className="td tabular text-right text-muted">{number(r.toofans)}</td>
                <td className="td tabular text-right text-muted">{number(r.tts)}</td>
                {money && <td className="td tabular text-right text-ink">{rupees(r.revenue)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-shell">
            <tr className="text-sm font-semibold text-ink">
              <td className="td">Total</td>
              <td className="td tabular text-right">{number(totals.visitors)}</td>
              <td className="td tabular text-right">{number(totals.vehicles)}</td>
              <td className="td tabular text-right">{number(totals.bikes)}</td>
              <td className="td tabular text-right">{number(totals.cars)}</td>
              <td className="td tabular text-right">{number(totals.toofans)}</td>
              <td className="td tabular text-right">{number(totals.tts)}</td>
              {money && <td className="td tabular text-right">{rupees(totals.revenue)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────── compare ── */

function Compare({ today }) {
  const [preset, setPreset] = useState('today_vs_yesterday');
  const [custom, setCustom] = useState({ from: '', to: '', againstFrom: '', againstTo: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const ready = preset !== 'custom' || Object.values(custom).every(Boolean);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    api.analyticsCompare(preset === 'custom' ? custom : { preset })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [preset, ready, custom.from, custom.to, custom.againstFrom, custom.againstTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setCustom((c) => ({ ...c, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[['today_vs_yesterday', 'Today vs yesterday'], ['week_vs_week', 'This week vs last'], ['month_vs_month', 'This month vs last'], ['custom', 'Custom']]
          .map(([key, label]) => (
            <button key={key} type="button" onClick={() => setPreset(key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${preset === key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-body hover:bg-shell'}`}>
              {label}
            </button>
          ))}
      </div>

      {preset === 'custom' && (
        <div className="card grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <div className="label">Period</div>
            <div className="flex items-center gap-1.5">
              <input type="date" className="input" max={today} value={custom.from} onChange={set('from')} />
              <span className="text-muted">–</span>
              <input type="date" className="input" max={today} value={custom.to} onChange={set('to')} />
            </div>
          </div>
          <div>
            <div className="label">Compared with</div>
            <div className="flex items-center gap-1.5">
              <input type="date" className="input" max={today} value={custom.againstFrom} onChange={set('againstFrom')} />
              <span className="text-muted">–</span>
              <input type="date" className="input" max={today} value={custom.againstTo} onChange={set('againstTo')} />
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm text-wrong-700">{error}</p>}
      {!ready && <p className="card px-4 py-10 text-center text-sm text-muted">Choose both periods to compare.</p>}

      {data && ready && (
        <>
          <p className="text-sm text-muted">
            <b className="text-ink">{dayLabel(data.current.from)}{data.current.days > 1 ? ` – ${dayLabel(data.current.to)}` : ''}</b>
            {' '}against{' '}
            <b className="text-ink">{dayLabel(data.against.from)}{data.against.days > 1 ? ` – ${dayLabel(data.against.to)}` : ''}</b>
            {data.current.days !== data.against.days && (
              <span className="ml-2 chip bg-watch-50 text-watch-700">Periods differ in length — compare per-day averages</span>
            )}
          </p>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-line bg-shell">
                <tr><th className="th">Measure</th><th className="th text-right">This period</th><th className="th text-right">Compared with</th><th className="th text-right">Change</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                <CompareRow label="Visitors" stat={data.visitors} />
                <CompareRow label="Vehicles entered" stat={data.vehicles} />
                <CompareRow label="Passes booked" stat={data.passes} />
                {data.revenue && <CompareRow label="Revenue" stat={data.revenue} money />}
                <CompareRow label="Vehicles per day" stat={data.perDay} />
                {data.byCategory.map((c) => (
                  <CompareRow key={c.code} label={<><span className="mr-1.5" aria-hidden>{VEHICLE_ICON[c.code]}</span>{c.label}</>} stat={c} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CompareRow({ label, stat, money }) {
  const fmt = money ? rupees : number;
  return (
    <tr>
      <td className="td text-ink">{label}</td>
      <td className="td tabular text-right font-semibold text-ink">{fmt(stat.value)}</td>
      <td className="td tabular text-right text-muted">{fmt(stat.previous)}</td>
      <td className="td text-right"><Delta stat={stat} /></td>
    </tr>
  );
}

/* ────────────────────────────────────────────────────────── visitors ── */

function Visitors({ bands }) {
  const [q, setQ] = useState('');
  const [band, setBand] = useState('');
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(bands || null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const PAGE = 25;

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      api.analyticsVisitors({ q: q.trim() || null, band: band || null, limit: PAGE, offset: page * PAGE })
        .then((d) => { if (alive) { setRows(d.visitors); setSummary(d.bands); setError(null); } })
        .catch((e) => alive && setError(e.message));
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [q, band, page]);

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Figure label="Visitors" value={number(summary.people)} sub={`${summary.visitsPerVisitor} visits each`} />
          <Figure label="Came back" value={`${summary.repeatShare}%`} sub="more than one visit" />
          <BandFigure band="first_time" count={summary.bands.first_time} total={summary.people} hint="1 visit" />
          <BandFigure band="occasional" count={summary.bands.occasional} total={summary.people} hint="2–3 visits" />
          <BandFigure band="returning" count={summary.bands.returning} total={summary.people} hint="4–7 visits" />
          <BandFigure band="frequent" count={summary.bands.frequent} total={summary.people} hint="8 or more" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input className="input !w-72" placeholder="Search name, mobile or vehicle" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select className="input !w-auto" value={band} onChange={(e) => { setBand(e.target.value); setPage(0); }}>
          <option value="">All visitors</option>
          {Object.entries(BAND).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && <p className="rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm text-wrong-700">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Visitor</th><th className="th">Mobile</th><th className="th">Vehicles</th>
              <th className="th text-right">Visits</th><th className="th">Type</th><th className="th">First visit</th>
              <th className="th">Previous</th><th className="th">Most recent</th><th className="th text-right">Per month</th>
              <th className="th">Usual slot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows === null && <tr><td className="td text-center text-muted" colSpan={10}>Loading…</td></tr>}
            {rows && rows.length === 0 && <tr><td className="td text-center text-muted" colSpan={10}>No visitors match.</td></tr>}
            {rows && rows.map((v) => (
              <tr key={v.id} className="cursor-pointer hover:bg-shell/60" onClick={() => setOpen(v.id)}>
                <td className="td font-medium text-ink">{v.name || '—'}</td>
                <td className="td font-mono text-muted">{v.mobile}</td>
                <td className="td font-mono text-2xs text-body">{v.vehicles.map(plate).join(', ')}</td>
                <td className="td tabular text-right font-semibold text-ink">{number(v.visits)}</td>
                <td className="td"><Chip map={BAND} value={v.band} /></td>
                <td className="td whitespace-nowrap text-muted">{v.firstVisit ? dayLabel(v.firstVisit) : '—'}</td>
                <td className="td whitespace-nowrap text-muted">{v.previousVisit ? dayLabel(v.previousVisit) : '—'}</td>
                <td className="td whitespace-nowrap text-ink">{v.lastVisit ? dayLabel(v.lastVisit) : '—'}</td>
                <td className="td tabular text-right text-muted">{v.visitsPerMonth ?? '—'}</td>
                <td className="td whitespace-nowrap text-2xs text-muted">{v.usualSlot || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} setPage={setPage} hasNext={rows && rows.length === PAGE} />
      </div>

      {open && <VisitorDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function BandFigure({ band, count, total, hint }) {
  const [label] = BAND[band];
  return <Figure label={label} value={number(count)} sub={`${total ? Math.round((count / total) * 100) : 0}% · ${hint}`} />;
}

function Pager({ page, setPage, hasNext }) {
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3">
      <span className="text-2xs text-muted">Page {page + 1}</span>
      <div className="flex gap-2">
        <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Previous</button>
        <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" disabled={!hasNext} onClick={() => setPage(page + 1)}>Next ›</button>
      </div>
    </div>
  );
}

/** A visitor's every pass — ticket, vehicle, slot, booked and entered times. */
function VisitorDrawer({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.analyticsVisitor(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{data?.visitor.name || 'Visitor'}</h2>
            {data && <p className="text-2xs text-muted">{data.visitor.mobile} · {data.visitor.language === 'kn' ? 'Kannada' : 'English'}</p>}
          </div>
          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={onClose}>Close</button>
        </div>
        {error && <p className="m-5 rounded-lg bg-wrong-50 px-4 py-3 text-sm text-wrong-700">{error}</p>}
        {!data && !error && <div className="m-5 h-40 animate-pulse rounded-lg bg-shell" />}
        {data && (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure label="Visits" value={number(data.visitor.visits)} />
              <Figure label="Type" value={<Chip map={BAND} value={data.visitor.band} />} />
              <Figure label="First visit" value={<span className="text-sm">{data.visitor.firstVisit ? dayLabel(data.visitor.firstVisit) : '—'}</span>} />
              <Figure label="Per month" value={data.visitor.visitsPerMonth ?? '—'} />
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="border-b border-line bg-shell">
                  <tr><th className="th">Visit date</th><th className="th">Pass</th><th className="th">Vehicle</th><th className="th">Slot</th><th className="th">Booked</th><th className="th">Entered</th><th className="th">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.passes.map((p) => (
                    <tr key={p.ticketNo}>
                      <td className="td whitespace-nowrap text-ink">{dayLabel(p.travelDate)}</td>
                      <td className="td font-mono text-2xs text-muted">{p.ticketNo}</td>
                      <td className="td"><div className="font-mono text-2xs text-ink">{plate(p.regNo)}</div><div className="text-2xs text-muted">{p.type}</div></td>
                      <td className="td text-2xs text-muted">{p.slot}</td>
                      <td className="td whitespace-nowrap text-2xs text-muted">{new Date(p.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="td tabular whitespace-nowrap text-2xs text-muted">{p.enteredAt ? clock(p.enteredAt) : '—'}</td>
                      <td className="td"><Chip map={STATUS} value={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── vehicles ── */

function Vehicles() {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function search(e) {
    e?.preventDefault();
    const term = q.trim();
    if (term.length < 4) { setError('Type at least four characters of the vehicle number.'); return; }
    setBusy(true);
    try {
      setData(await api.analyticsVehicle(term));
      setError(null);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const v = data?.vehicle;
  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-center gap-2" onSubmit={search}>
        <input className="input !w-72 font-mono uppercase tracking-wide" placeholder="Vehicle number, e.g. KA31N8147"
          value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="characters" />
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Searching…' : 'Look up'}</button>
        <span className="text-2xs text-muted">From bookings and the vehicle cache — never a new government lookup.</span>
      </form>

      {error && <p className="rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm text-wrong-700">{error}</p>}
      {!data && !error && <p className="card px-4 py-12 text-center text-sm text-muted">Look up a vehicle to see its visits, who booked it and what it paid.</p>}

      {data && (
        <>
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-shell px-5 py-4">
              <div>
                <div className="font-mono text-2xl font-bold text-ink">{plate(v.regNo)}</div>
                <div className="text-sm text-muted">
                  {v.unknown ? 'Not in the vehicle cache' : [v.maker, v.model, v.fuel, v.colour].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data.category && <span className="chip bg-brand/10 text-brand">{data.category}</span>}
                <Chip map={BAND} value={data.band} />
                {v.isTest && <span className="chip bg-watch-50 text-watch-700" title="Invented for testing">Test data</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              {[
                ['Visits', number(data.visits)],
                ['Passes booked', number(data.passes)],
                ['Total paid', rupees(data.totalPaid)],
                ['Per month', data.visitsPerMonth ?? '—'],
                ['First visit', data.firstVisit ? dayLabel(data.firstVisit) : '—'],
                ['Previous visit', data.previousVisit ? dayLabel(data.previousVisit) : '—'],
                ['Last visit', data.lastVisit ? dayLabel(data.lastVisit) : '—'],
                ['Usual slot', data.usualSlot ? `${data.usualSlot.label} (${data.usualSlot.times}×)` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-4 py-3">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
                  <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
                </div>
              ))}
            </div>
            {!v.unknown && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line px-5 py-4 text-sm sm:grid-cols-4">
                <Detail label="Registration class" value={v.vehicleClass} />
                <Detail label="Category (RC)" value={v.vehicleCategory} />
                <Detail label="Seats" value={v.seats} />
                <Detail label="Registered" value={v.registered} />
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <Card title="Booked by" note="From the bookings for this vehicle">
              <ul className="divide-y divide-line">
                {data.bookedBy.map((b, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div><div className="text-ink">{b.name || '—'}</div><div className="font-mono text-2xs text-muted">{b.mobile}</div></div>
                    <span className="tabular text-muted">{number(b.passes)} pass{b.passes === 1 ? '' : 'es'}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Visit history" note={`${number(data.history.length)} passes, newest first`}>
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="sticky top-0 border-b border-line bg-shell">
                    <tr><th className="th">Date</th><th className="th">Pass</th><th className="th">Slot</th><th className="th">Visitor</th><th className="th text-right">Paid</th><th className="th">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.history.map((h) => (
                      <tr key={h.ticketNo}>
                        <td className="td whitespace-nowrap text-ink">{dayLabel(h.travelDate)}</td>
                        <td className="td font-mono text-2xs text-muted">{h.ticketNo}</td>
                        <td className="td text-2xs text-muted">{h.slot}</td>
                        <td className="td text-body">{h.visitor || '—'}</td>
                        <td className="td tabular text-right text-ink">{rupees(h.amount)}</td>
                        <td className="td"><Chip map={STATUS} value={h.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

const Detail = ({ label, value }) => (
  <div>
    <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
    <div className="mt-0.5 text-ink">{value || '—'}</div>
  </div>
);

/* ─────────────────────────────────────────────────────────────── staff ── */

function Staff({ rows }) {
  return (
    <div className="space-y-5">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Staff</th><th className="th">First sign-in</th><th className="th">Last sign-out</th>
              <th className="th text-right">Checks</th><th className="th text-right">Valid</th><th className="th text-right">Invalid</th>
              <th className="th text-right">Duplicate</th><th className="th text-right">Admitted anyway</th>
              <th className="th text-right">Average</th><th className="th text-right">Fastest</th><th className="th text-right">Slowest</th>
              <th className="th">Peak hour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="td font-medium text-ink">{s.name}</td>
                <td className="td whitespace-nowrap text-2xs text-muted">{s.shifts ? new Date(s.shifts.firstIn).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                <td className="td whitespace-nowrap text-2xs text-muted">{s.shifts ? new Date(s.shifts.lastOut).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                <td className="td tabular text-right font-semibold text-ink">{number(s.checks)}</td>
                <td className="td tabular text-right text-good-700">{number(s.valid)}</td>
                <td className="td tabular text-right text-wrong-700">{number(s.invalid)}</td>
                <td className="td tabular text-right text-wrong-700">{number(s.duplicate)}</td>
                <td className="td tabular text-right text-watch-700">{number(s.admittedAnyway)}</td>
                <td className="td tabular text-right text-ink">{secs(s.averageMs)}</td>
                <td className="td tabular text-right text-muted">{secs(s.fastestMs)}</td>
                <td className="td tabular text-right text-muted">{secs(s.slowestMs)}</td>
                <td className="td whitespace-nowrap text-muted">{s.peakHour ? `${s.peakHour.label} · ${number(s.peakHour.entries)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-2xs text-muted">
        Sign-in and sign-out come from gate shifts; staff who checked vehicles without a recorded shift in this range show a dash.
        Verification time is measured by the gate app, from opening a pass to recording the entry.
      </p>
    </div>
  );
}
