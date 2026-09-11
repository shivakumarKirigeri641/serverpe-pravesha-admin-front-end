import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend as RLegend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { clock, number, percent, plate } from '../lib/format';

/*
 * Live monitoring — what is happening at the gates right now.
 *
 * IT POLLS, AND SAYS WHEN IT LAST HEARD. Every few seconds, and only while the
 * tab is visible: a screen left on a wall overnight should not hammer the server
 * for nobody. The header carries the time of the last answer, so a frozen screen
 * is visibly frozen rather than quietly stale — the worst failure for a live
 * view is looking alive while showing yesterday.
 *
 * EVERY COMPARISON IS AGAINST YESTERDAY AT THIS HOUR, computed by the back-end.
 * Comparing eleven in the morning against a whole day would report a collapse
 * every morning.
 *
 * NEW EVENTS ANNOUNCE THEMSELVES. Rows that arrived since the last poll are
 * briefly highlighted, so somebody glancing over sees what changed instead of
 * re-reading the whole table.
 */

const POLL_MS = 8000;

export default function Live() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [fresh, setFresh] = useState(() => new Set());
  const seen = useRef(new Set());

  /*
   * The feed pages backwards through the day. Page one is live and keeps
   * refreshing; any page after it is a fixed window into the past, and polling
   * must not shuffle rows under somebody's finger — so while paged back, the
   * counters keep updating and the table does not.
   */
  const [feed, setFeed] = useState(null);      // null = page one, follow the live payload
  const [pageNo, setPageNo] = useState(1);
  const [paging, setPaging] = useState(false);
  const trail = useRef([]);                    // cursors, so Back can retrace

  const load = useCallback(async () => {
    try {
      const d = await api.live();
      /* Which activity rows are new since the last answer. */
      const incoming = new Set(d.activity.rows.map((a) => a.id));
      const isFirst = seen.current.size === 0;
      const added = isFirst ? new Set() : new Set([...incoming].filter((id) => !seen.current.has(id)));
      seen.current = incoming;
      setFresh(added);
      setData(d);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const older = useCallback(async () => {
    const cursor = feed ? feed.nextCursor : data?.activity?.nextCursor;
    if (!cursor) return;
    setPaging(true);
    try {
      const page = await api.liveActivity({ before: cursor });
      trail.current.push(cursor);
      setFeed(page);
      setPageNo((p) => p + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setPaging(false);
    }
  }, [feed, data]);

  const newer = useCallback(async () => {
    /* One step back is the cursor before the one that produced this page. */
    trail.current.pop();
    const previous = trail.current[trail.current.length - 1] || null;
    if (!previous) { setFeed(null); setPageNo(1); return; }
    setPaging(true);
    try {
      setFeed(await api.liveActivity({ before: previous }));
      setPageNo((p) => Math.max(1, p - 1));
    } catch (e) {
      setError(e.message);
    } finally {
      setPaging(false);
    }
  }, []);

  const backToLive = useCallback(() => { trail.current = []; setFeed(null); setPageNo(1); }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, [load]);

  const v = data?.visitors;
  const onLive = feed === null;
  const rows = onLive ? (data?.activity.rows || []) : feed.rows;
  const hasOlder = onLive ? Boolean(data?.activity.hasMore) : feed.hasMore;

  return (
    <Shell
      title="Live monitoring — real-time entry operations"
      subtitle={data
        ? `${data.serverTime} IST · against ${data.comparedWith} at the same hour`
        : 'Connecting…'}
      actions={
        <span className="hidden items-center gap-2 text-2xs text-muted sm:flex">
          <span className={`h-2 w-2 rounded-full ${error ? 'bg-wrong-500' : 'animate-pulse bg-good-500'}`} />
          {error ? 'Not updating' : updatedAt ? `Updated ${clock(updatedAt.toISOString())}` : 'Waiting'}
        </span>
      }
    >
      {error && (
        <div className="mb-5 rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm font-medium text-wrong-700">
          {error} <button type="button" className="ml-2 underline" onClick={load}>Retry now</button>
        </div>
      )}

      {!data && !error && <Skeleton />}

      {data && (
        <div className="space-y-6">
          {/* A. Live visitor counter */}
          <section>
            <SectionTitle label="Visitors today" hint="Against yesterday at this hour" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <Counter label="Booked" stat={v.booked} good="up" />
              <Counter label="Entered" stat={v.entered} good="up" hint="Entry recorded at a gate" />
              <Counter label="Checked at gate" stat={v.checkedAtGate} good="up" hint="Passes looked up, however they ended" />
              <Counter label="Yet to arrive" stat={v.yetToArrive} hint="Slot still open" />
              <Counter label="Skipped" stat={v.skipped} good="down" hint="Slot closed, never came" />
              <Counter label="Inside now" stat={v.inside} hint="Estimated — no exit is recorded" estimated />
              <Counter label="Total entries" stat={v.totalEntries} good="up" hint="Including re-entries" />
            </div>
          </section>

          {/* B. Live vehicle counter */}
          <section>
            <SectionTitle label="Vehicles entered" hint="Share of today's traffic, and change on yesterday" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.vehicles.map((veh) => (
                <div key={veh.code} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-muted">
                      <span className="text-base" aria-hidden>{VEHICLE_ICON[veh.code] || '🚘'}</span>{veh.label}
                    </span>
                    <Delta stat={veh} good="up" />
                  </div>
                  <div className="mt-1.5 tabular text-3xl font-bold leading-none text-ink">{number(veh.value)}</div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-shell">
                    <div className="h-full rounded-full bg-brand-accent" style={{ width: `${veh.shareOfTraffic}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-2xs text-muted">
                    <span>{veh.shareOfTraffic}% of traffic</span>
                    <span>yesterday {number(veh.previous)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* C + D. Traffic graphs */}
          <section className="grid gap-4 xl:grid-cols-2">
            <div className="card overflow-hidden">
              <CardHead title="Traffic by hour" note="Today against yesterday" />
              <div className="h-64 px-2 pb-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.traffic} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gToday" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00a884" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00a884" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e4eaea" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP} formatter={(val, key) => [number(val), key === 'today' ? 'Today' : 'Yesterday']} />
                    <Area type="monotone" dataKey="yesterday" stroke="#9fb0aa" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
                    <Area type="monotone" dataKey="today" stroke="#00a884" strokeWidth={2.5} fill="url(#gToday)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 border-t border-line px-4 py-2.5 text-2xs text-muted">
                <Legend colour="#00a884" label="Today" />
                <Legend colour="#9fb0aa" label="Yesterday" />
                <span className="ml-auto">
                  Difference so far:{' '}
                  <b className={data.visitors.totalEntries.diff >= 0 ? 'text-good-700' : 'text-wrong-700'}>
                    {data.visitors.totalEntries.diff >= 0 ? '+' : '−'}{Math.abs(data.visitors.totalEntries.diff)}
                  </b>
                </span>
              </div>
            </div>

            <div className="card overflow-hidden">
              <CardHead title="By vehicle type" note="Entries each hour" />
              <div className="h-64 px-2 pb-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trafficByCategory} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e4eaea" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: '#f6f8f8' }} />
                    <RLegend wrapperStyle={{ fontSize: 11, color: '#6b7f80' }} />
                    <Bar dataKey="BIKE" name="Bike" stackId="a" fill="#00a884" />
                    <Bar dataKey="CAR" name="Car" stackId="a" fill="#075e54" />
                    <Bar dataKey="TOOFAN" name="Toofan" stackId="a" fill="#e08700" />
                    <Bar dataKey="TT" name="TT" stackId="a" fill="#6b7f80" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* I + G. The vehicle in hand, and how fast the gate is working */}
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <CurrentVehicle current={data.current} />
            <Performance performance={data.performance} verdicts={data.verdicts} />
          </section>

          {/* F. Staff */}
          <section>
            <SectionTitle label="Checkpost staff" hint="On duty, and how they are working" />
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="border-b border-line bg-shell">
                  <tr>
                    <th className="th">Staff</th><th className="th">Checkpost</th><th className="th">State</th>
                    <th className="th text-right">Checked</th><th className="th text-right">Entries</th>
                    <th className="th text-right">Average</th><th className="th text-right">Fastest</th>
                    <th className="th text-right">Slowest</th><th className="th text-right">Last check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.staff.map((s) => (
                    <tr key={s.id}>
                      <td className="td font-medium text-ink">{s.name}</td>
                      <td className="td text-muted">{s.checkpost || '—'}</td>
                      <td className="td"><StaffState staff={s} /></td>
                      <td className="td tabular text-right text-ink">{number(s.checks)}</td>
                      <td className="td tabular text-right text-muted">{number(s.entries)}</td>
                      <td className="td tabular text-right text-ink">{secs(s.averageMs)}</td>
                      <td className="td tabular text-right text-muted">{secs(s.fastestMs)}</td>
                      <td className="td tabular text-right text-muted">{secs(s.slowestMs)}</td>
                      <td className="td tabular text-right text-muted">{s.lastCheckAt ? clock(s.lastCheckAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* E + H. The feed */}
          <section>
            <SectionTitle
              label="Live checkpost activity"
              hint={`${number(data.activity.counts.today)} checks today · ${number(data.activity.counts.total)} in all · newest first`}
            />
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-line bg-shell">
                  <tr>
                    <th className="th">Time</th><th className="th">Staff</th><th className="th">Type</th>
                    <th className="th">Vehicle</th><th className="th">Pass</th><th className="th">Visitor</th>
                    <th className="th">Result</th><th className="th text-right">Took</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.length === 0 && (
                    <tr><td className="td text-center text-muted" colSpan={8}>No checks recorded.</td></tr>
                  )}
                  {rows.map((a) => (
                    <tr key={a.id} className={onLive && fresh.has(a.id) ? 'animate-[pulse_1.2s_ease-in-out_2] bg-good-50/60' : undefined}>
                      <td className="td tabular whitespace-nowrap text-muted">{clock(a.at)}</td>
                      <td className="td text-body">{a.staff || '—'}</td>
                      <td className="td text-muted">
                        <span className="mr-1.5" aria-hidden>{VEHICLE_ICON[a.typeCode] || ''}</span>{a.type || '—'}
                      </td>
                      <td className="td font-mono font-semibold text-ink">{plate(a.regNo)}</td>
                      <td className="td font-mono text-muted">{a.ticketNo || '—'}</td>
                      <td className="td text-muted">{a.visitor || '—'}</td>
                      <td className="td"><VerdictChip verdict={a.verdict} /></td>
                      <td className="td tabular text-right text-muted">{secs(a.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                <span className="text-2xs text-muted">
                  {onLive
                    ? `Newest ${number(rows.length)} checks · updating live`
                    : `Page ${pageNo} · paused while you look back`}
                </span>
                <div className="flex items-center gap-2">
                  {!onLive && (
                    <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={backToLive} disabled={paging}>
                      Back to live
                    </button>
                  )}
                  <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs"
                    onClick={newer} disabled={paging || onLive}>‹ Newer</button>
                  <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs"
                    onClick={older} disabled={paging || !hasOlder}>Older ›</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

const TOOLTIP = {
  borderRadius: 10, border: '1px solid #e4eaea',
  boxShadow: '0 12px 32px rgba(15,26,28,.12)', fontSize: 13,
};

const VEHICLE_ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

const VERDICTS = {
  valid: ['Valid entry', 'bg-good-50 text-good-700'],
  valid_override: ['Admitted anyway', 'bg-watch-50 text-watch-700'],
  already_used: ['Already used', 'bg-wrong-50 text-wrong-700'],
  wrong_day: ['Wrong date', 'bg-wrong-50 text-wrong-700'],
  wrong_place: ['Wrong gate', 'bg-wrong-50 text-wrong-700'],
  wrong_slot: ['Outside slot', 'bg-watch-50 text-watch-700'],
  not_paid: ['Not paid', 'bg-wrong-50 text-wrong-700'],
  cancelled: ['Cancelled', 'bg-wrong-50 text-wrong-700'],
  unknown_ticket: ['Invalid pass', 'bg-wrong-50 text-wrong-700'],
};

function VerdictChip({ verdict }) {
  const [label, tone] = VERDICTS[verdict] || [verdict, 'bg-shell text-muted'];
  return <span className={`chip ${tone}`}>{label}</span>;
}

/** Milliseconds as a person would say them: '4.2 sec', '1 min 12 sec', '—'. */
function secs(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} sec`;
  const m = Math.floor(ms / 60000);
  return `${m} min ${Math.round((ms % 60000) / 1000)} sec`;
}

function SectionTitle({ label, hint }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{label}</h2>
      {hint && <span className="text-2xs text-muted">{hint}</span>}
    </div>
  );
}

function CardHead({ title, note }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {note && <span className="text-2xs text-muted">{note}</span>}
    </div>
  );
}

const Legend = ({ colour, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ background: colour }} />{label}
  </span>
);

function Delta({ stat, good = 'up', className = '' }) {
  if (!stat || stat.previous === undefined) return null;
  const text = percent(stat.percent);
  if (stat.direction === 'flat') return <span className={`chip bg-shell text-muted ${className}`}>no change</span>;
  if (text === null) return <span className={`chip bg-brand/10 text-brand ${className}`}>new</span>;
  const favourable = good === 'neutral' ? null : (stat.direction === 'up') === (good === 'up');
  const tone = favourable === null ? 'bg-shell text-body'
    : favourable ? 'bg-good-50 text-good-700' : 'bg-wrong-50 text-wrong-700';
  return (
    <span className={`chip ${tone} ${className}`} title={`${stat.previous} at this hour yesterday`}>
      <span aria-hidden>{stat.direction === 'up' ? '▲' : '▼'}</span>{text}
    </span>
  );
}

function Counter({ label, stat, good, hint, estimated }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        <Delta stat={stat} good={good} />
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="tabular text-3xl font-bold leading-none text-ink">{number(stat.value)}</span>
        {estimated && <span className="text-2xs font-semibold uppercase tracking-wider text-watch-700">est.</span>}
      </div>
      {hint && <div className="mt-2 text-2xs text-muted">{hint}</div>}
    </div>
  );
}

function StaffState({ staff: s }) {
  if (!s.onDuty) return <span className="chip bg-shell text-muted">Off duty</span>;
  if (s.checkingNow) return <span className="chip bg-brand text-white">Checking now</span>;
  if (s.online) return <span className="chip bg-good-50 text-good-700">Online</span>;
  return (
    <span className="chip bg-watch-50 text-watch-700" title={`Last seen ${s.secondsSinceSeen}s ago`}>
      On duty · quiet
    </span>
  );
}

/** G. How fast the gate is working, and today's verdict tally beside it. */
function Performance({ performance: p, verdicts }) {
  const events = [
    ['Valid entry', verdicts.valid, 'text-good-700'],
    ['Already used', verdicts.alreadyUsed, 'text-wrong-700'],
    ['Invalid pass', verdicts.invalid, 'text-wrong-700'],
    ['Repeat attempt', verdicts.repeatAttempt, 'text-wrong-700'],
    ['Outside slot', verdicts.outsideSlot, 'text-watch-700'],
    ['Admitted anyway', verdicts.allowedLate, 'text-watch-700'],
    ['Cancelled', verdicts.cancelled, 'text-wrong-700'],
    ['Vehicle mismatch', verdicts.vehicleMismatch, 'text-line'],
  ];

  return (
    <div className="card">
      <CardHead title="Scan performance" note={p.measured ? `${number(p.measured)} checks timed` : 'No timings yet'} />
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
        <Stat label="Average" value={secs(p.averageMs)} />
        <Stat label="Fastest" value={secs(p.fastestMs)} />
        <Stat label="Slowest" value={secs(p.slowestMs)} />
        <Stat label="Per minute" value={p.perMinute === null ? '—' : p.perMinute} />
        <Stat label="Per hour" value={p.perHour === null ? '—' : number(p.perHour)} />
        <Stat label="Peak hour" value={p.peak ? p.peak.label : '—'} sub={p.peak ? `${number(p.peak.entries)} entries` : null} />
      </div>

      <div className="border-t border-line px-4 py-3">
        <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted">Today&rsquo;s verdicts</h4>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {events.map(([label, value, tone]) => (
            <li key={label} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-body">{label}</span>
              <span className={`tabular font-semibold ${value === null ? 'text-line' : tone}`}
                title={value === null ? 'Not measured: staff look a vehicle up by its own number' : undefined}>
                {value === null ? '—' : number(value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const Stat = ({ label, value, sub }) => (
  <div className="bg-white px-4 py-3">
    <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
    <div className="tabular mt-0.5 text-lg font-bold text-ink">{value}</div>
    {sub && <div className="text-2xs text-muted">{sub}</div>}
  </div>
);

/** I. Everything about the vehicle just checked, without searching for it. */
function CurrentVehicle({ current }) {
  if (!current) {
    return (
      <div className="card grid place-items-center p-10 text-center">
        <div>
          <div className="text-sm font-semibold text-ink">No vehicle checked yet</div>
          <p className="mt-1 text-2xs text-muted">The last vehicle checked at any gate appears here.</p>
        </div>
      </div>
    );
  }

  const { vehicle, pass, visitor, visits } = current;
  const tone = current.verdict === 'valid' || current.verdict === 'valid_override' ? 'bg-good-50' : 'bg-wrong-50';

  return (
    <div className="card overflow-hidden">
      <CardHead title="Last vehicle checked" note={`${clock(current.at)} · ${current.checkpost || 'gate'}`} />
      <div className={`flex items-center justify-between gap-3 px-4 py-3 ${tone}`}>
        <div>
          <div className="font-mono text-2xl font-bold text-ink">{plate(vehicle.regNo)}</div>
          <div className="text-2xs text-muted">
            {[vehicle.description, vehicle.type, vehicle.colour].filter(Boolean).join(' · ') || 'Not in the cache'}
          </div>
        </div>
        <div className="text-right">
          <VerdictChip verdict={current.verdict} />
          <div className="mt-1 text-2xs text-muted">{secs(current.durationMs)}</div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-4 text-sm">
        <Field label="Pass" value={pass?.ticketNo} mono />
        <Field label="Status" value={pass?.status} />
        <Field label="Visitor" value={visitor?.name} />
        <Field label="Mobile" value={visitor?.mobile} />
        <Field label="Destination" value={pass?.place} />
        <Field label="Slot" value={pass?.slot} />
        <Field label="Travel date" value={pass?.travelDate} />
        <Field label="Booked on" value={pass?.bookedAt ? new Date(pass.bookedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null} />
        <Field label="Checked by" value={current.staff} />
        <Field label="Visit" value={`${visits.current}${visits.previous ? ` · ${visits.previous} previous` : ' · first visit'}`} />
      </dl>
    </div>
  );
}

const Field = ({ label, value, mono }) => (
  <div>
    <dt className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
    <dd className={`mt-0.5 ${mono ? 'font-mono' : ''} ${value ? 'text-ink' : 'text-line'}`}>{value || '—'}</dd>
  </div>
);

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="card h-28 animate-pulse" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card h-72 animate-pulse" /><div className="card h-72 animate-pulse" />
      </div>
    </div>
  );
}
