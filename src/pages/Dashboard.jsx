import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { clock, dayLabel, number, percent, plate, rupees, shiftDay } from '../lib/format';

/*
 * Dashboard — today at a glance.
 *
 * WHY EVERY FIGURE CARRIES YESTERDAY. A count alone is not information: forty
 * arrivals is a good morning or a collapse depending on what yesterday did. The
 * comparison therefore sits with the number, not on a screen nobody opens.
 *
 * WHICH DIRECTION IS GOOD DEPENDS ON THE FIGURE. More bookings is good; more
 * duplicate presentations is not. Each tile declares which way is favourable and
 * the colour follows the meaning rather than the sign — a dashboard that paints
 * "duplicates +300%" in green has taught its reader to ignore colour.
 *
 * A DASH MEANS NOT MEASURED, AND SAYS SO ON HOVER. Rescheduling, vehicle
 * mismatch and settlement figures do not exist in the product yet. Showing zero
 * for them would read as "nothing happened", which is a different claim.
 *
 * It refreshes quietly while the tab is visible, since this screen is left up on
 * a second monitor all day.
 */

const REFRESH_MS = 60000;

export default function Dashboard() {
  const [date, setDate] = useState(null);      // null = today, by the server's clock
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const d = await api.dashboard(date);
      setData(d);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load({ quiet: true }); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const day = data?.date;

  return (
    <Shell
      title="Dashboard — today at a glance"
      subtitle={day
        ? `${dayLabel(day)}${data.isToday ? ` · ${data.serverTime} IST` : ''} · against ${dayLabel(data.comparedWith)}`
        : 'Loading…'}
      actions={
        <div className="hidden items-center gap-1.5 md:flex">
          <button type="button" className="btn-quiet !px-2.5 !py-1.5" aria-label="Previous day"
            onClick={() => setDate(shiftDay(day || new Date().toISOString().slice(0, 10), -1))}>‹</button>
          <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={day || ''}
            onChange={(e) => setDate(e.target.value || null)} />
          <button type="button" className="btn-quiet !px-2.5 !py-1.5" aria-label="Next day"
            onClick={() => setDate(shiftDay(day || new Date().toISOString().slice(0, 10), 1))}>›</button>
          {data && !data.isToday && (
            <button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={() => setDate(null)}>Today</button>
          )}
        </div>
      }
    >
      {error && (
        <div className="mb-5 rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm font-medium text-wrong-700">
          {error} <button type="button" className="ml-2 underline" onClick={() => load()}>Retry</button>
        </div>
      )}

      {loading && !data && <Skeleton />}

      {data && (
        <div className="space-y-6">
          <Group title="Today's bookings" hint="Passes paid for this date, whenever they were bought">
            <Tile label="Total booked" stat={data.bookings.total} good="up" />
            <Tile label="Advance" stat={data.bookings.advance} good="up" hint="Bought on an earlier day" />
            <Tile label="Same day" stat={data.bookings.sameDay} good="up" hint="Bought on the day of travel" />
            <Tile label="Cancelled" stat={data.bookings.cancelled} good="down" />
            <Tile label="Expired" stat={data.bookings.expired} good="down" hint="Holds never paid for" />
            <Tile label="Rescheduled" stat={data.bookings.rescheduled} note="Rescheduling is not offered yet" />
          </Group>

          <Group title="Visitor status" hint="Where today's passes stand right now">
            <Tile label="Booked" stat={data.visitors.booked} good="up" />
            <Tile label="Arrived" stat={data.visitors.arrived} good="up" hint="Presented at a gate" />
            <Tile label="Entered" stat={data.visitors.entered} good="up" hint="Recorded as entering" />
            <Tile label="Yet to arrive" stat={data.visitors.yetToArrive} good="neutral" hint="Slot still open" />
            <Tile label="Skipped" stat={data.visitors.skipped} good="down" hint="No-show: slot has closed" />
            <Tile label="Cancelled" stat={data.visitors.cancelled} good="down" />
          </Group>

          <Group title="Verification at the gate" hint="What staff checks returned">
            <Tile label="Valid" stat={data.verification.valid} good="up" />
            <Tile label="Used" stat={data.verification.used} good="up" hint="Entry recorded" />
            <Tile label="Duplicate" stat={data.verification.duplicate} good="down" hint="Same pass presented twice" />
            <Tile label="Invalid" stat={data.verification.invalid} good="down" hint="Wrong day, wrong gate, unpaid, unknown" />
            <Tile label="Repeat attempt" stat={data.verification.repeatAttempt} good="down" hint="Refused, then tried again" />
            <Tile label="Suspicious" stat={data.verification.suspicious} good="down" hint="Duplicates plus repeat attempts" />
            <Tile label="Outside slot" stat={data.verification.outsideSlot} good="down" />
            <Tile label="Allowed late" stat={data.verification.allowedLate} good="down" hint="Staff admitted anyway" />
            <Tile label="Vehicle mismatch" stat={data.verification.vehicleMismatch}
              note="Staff look a vehicle up by its own number, so there is nothing to mismatch" />
          </Group>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="card overflow-hidden">
              <CardHead title="Bookings and entries" note="Last 14 days" />
              <div className="h-64 px-2 pb-3 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gBooked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00a884" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00a884" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e4eaea" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false}
                      tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40}
                      tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', boxShadow: '0 12px 32px rgba(15,26,28,.12)', fontSize: 13 }}
                      labelFormatter={dayLabel}
                      formatter={(v, k) => [k === 'collected' ? rupees(v) : number(v),
                        k === 'booked' ? 'Booked' : k === 'entered' ? 'Entered' : 'Collected']}
                    />
                    <Area type="monotone" dataKey="booked" stroke="#00a884" strokeWidth={2} fill="url(#gBooked)" />
                    <Area type="monotone" dataKey="entered" stroke="#075e54" strokeWidth={2} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 border-t border-line px-4 py-2.5 text-2xs text-muted">
                <Legend colour="#00a884" label="Booked" />
                <Legend colour="#075e54" label="Entered" />
              </div>
            </div>

            <Revenue revenue={data.revenue} config={data.config} />
          </section>

          <section>
            <SectionTitle
              label="Vehicle capacity"
              hint={`${number(data.capacity.available)} of ${number(data.capacity.capacity)} places open · ${data.capacity.occupancyPercent}% taken`}
            />
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-line bg-shell">
                  <tr>
                    <th className="th">Vehicle</th>
                    <th className="th text-right">Booked</th>
                    <th className="th text-right">Capacity</th>
                    <th className="th text-right">Available</th>
                    <th className="th text-right">Occupancy</th>
                    <th className="th text-right">vs yesterday</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.capacity.byVehicle.map((v) => (
                    <tr key={v.code}>
                      <td className="td">
                        <span className="mr-2" aria-hidden>{VEHICLE_ICON[v.code] || '🚘'}</span>
                        <span className="font-medium text-ink">{v.label}</span>
                      </td>
                      <td className="td tabular text-right font-semibold text-ink">{number(v.booked)}</td>
                      <td className="td tabular text-right text-muted">{number(v.capacity)}</td>
                      <td className={`td tabular text-right ${v.available === 0 ? 'font-semibold text-wrong-700' : 'text-ink'}`}>{number(v.available)}</td>
                      <td className="td text-right">
                        <Occupancy percent={v.occupancyPercent} />
                      </td>
                      <td className="td text-right"><Delta stat={v} good="up" className="justify-end" /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-shell">
                  <tr className="text-sm font-semibold text-ink">
                    <td className="td">All vehicles</td>
                    <td className="td tabular text-right">{number(data.capacity.booked)}</td>
                    <td className="td tabular text-right">{number(data.capacity.capacity)}</td>
                    <td className="td tabular text-right">{number(data.capacity.available)}</td>
                    <td className="td text-right"><Occupancy percent={data.capacity.occupancyPercent} /></td>
                    <td className="td" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section>
            <SectionTitle label="Slots" hint="Capacity for this date, by time of day" />
            <div className="grid gap-4 lg:grid-cols-2">
              {data.slots.map((s) => <SlotCard key={`${s.placeId}:${s.slotId}`} slot={s} />)}
            </div>
          </section>

          <section className="card">
            <CardHead title="Latest at the checkpost" note={updatedAt ? `Updated ${clock(updatedAt.toISOString())}` : null} />
            {data.recent.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No entries recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-line bg-shell">
                    <tr>
                      <th className="th">Time</th><th className="th">Vehicle</th><th className="th">Pass</th>
                      <th className="th">Outcome</th><th className="th">Recorded by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.recent.map((r, i) => (
                      <tr key={`${r.ticketNo}-${i}`}>
                        <td className="td tabular whitespace-nowrap text-muted">{clock(r.at)}</td>
                        <td className="td font-mono font-semibold text-ink">{plate(r.regNo)}</td>
                        <td className="td font-mono text-muted">{r.ticketNo || '—'}</td>
                        <td className="td"><VerdictChip verdict={r.verdict} /></td>
                        <td className="td text-muted">{r.staff || '—'}{r.checkpost ? ` · ${r.checkpost}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}

const VEHICLE_ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

const VERDICTS = {
  valid: ['Entered', 'bg-good-50 text-good-700'],
  valid_override: ['Allowed late', 'bg-watch-50 text-watch-700'],
  already_used: ['Duplicate', 'bg-wrong-50 text-wrong-700'],
  wrong_day: ['Wrong date', 'bg-wrong-50 text-wrong-700'],
  wrong_place: ['Wrong gate', 'bg-wrong-50 text-wrong-700'],
  wrong_slot: ['Outside slot', 'bg-watch-50 text-watch-700'],
  not_paid: ['Unpaid', 'bg-wrong-50 text-wrong-700'],
  cancelled: ['Cancelled', 'bg-wrong-50 text-wrong-700'],
  unknown_ticket: ['No such pass', 'bg-wrong-50 text-wrong-700'],
};

function VerdictChip({ verdict }) {
  const [label, tone] = VERDICTS[verdict] || [verdict, 'bg-shell text-muted'];
  return <span className={`chip ${tone}`}>{label}</span>;
}

function Group({ title, hint, children }) {
  return (
    <section>
      <SectionTitle label={title} hint={hint} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{children}</div>
    </section>
  );
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

function Occupancy({ percent: p }) {
  const tone = p >= 90 ? 'bg-wrong-500' : p >= 60 ? 'bg-watch-500' : 'bg-brand-accent';
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-shell">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, p)}%` }} />
      </span>
      <span className="tabular w-9 text-right text-sm text-ink">{p}%</span>
    </span>
  );
}

/**
 * `good` says which direction is the good one, so colour carries meaning:
 * 'up' for figures we want rising, 'down' for the ones we want falling,
 * 'neutral' where a change is just a change.
 */
function Delta({ stat, good = 'up', className = '' }) {
  const text = percent(stat.percent);
  if (stat.direction === 'flat') return <span className={`chip bg-shell text-muted ${className}`}>no change</span>;
  if (text === null) return <span className={`chip bg-brand/10 text-brand ${className}`}>new</span>;

  const favourable = good === 'neutral' ? null : (stat.direction === 'up') === (good === 'up');
  const tone = favourable === null ? 'bg-shell text-body'
    : favourable ? 'bg-good-50 text-good-700' : 'bg-wrong-50 text-wrong-700';

  return (
    <span className={`chip ${tone} ${className}`} title={`${stat.previous} yesterday`}>
      <span aria-hidden>{stat.direction === 'up' ? '▲' : '▼'}</span>{text}
    </span>
  );
}

/** A figure that is not measured renders as a dash that explains itself. */
function Tile({ label, stat, good, hint, note }) {
  if (!stat) {
    return (
      <div className="card border-dashed p-4" title={note}>
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        <div className="mt-1.5 text-3xl font-bold leading-none text-line">—</div>
        <div className="mt-2 text-2xs text-muted">{note || 'Not measured yet'}</div>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        <Delta stat={stat} good={good} />
      </div>
      <div className="mt-1.5 tabular text-3xl font-bold leading-none text-ink">{number(stat.value)}</div>
      <div className="mt-2 text-2xs text-muted">
        {hint && <>{hint}<span className="mx-1.5 text-line">|</span></>}
        yesterday {number(stat.previous)}
      </div>
    </div>
  );
}

function Revenue({ revenue, config }) {
  const rows = [
    ['Total ticket value', revenue.ticketValue.value, 'What today’s passes are worth'],
    ['Tourism Department', revenue.departmentAmount, 'Entry fees, collected on their behalf'],
    [`Pravesha service fee (${config.serviceFeePercent}%)`, revenue.serviceFee, 'Our share, GST inclusive'],
    [`GST on service fee (${config.gstPercentOnServiceFee}%)`, -revenue.gst, 'Payable, included in the fee above'],
    ['Payment gateway', revenue.gatewayCharges === null ? null : -revenue.gatewayCharges,
      revenue.gatewayCharges === null ? 'Reported by Razorpay once settled' : 'Razorpay charges on today’s payments'],
  ];

  return (
    <div className="card">
      <CardHead title="Revenue" note="For this date" />
      <ul className="divide-y divide-line">
        {rows.map(([label, value, hint]) => (
          <li key={label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm text-body">{label}</div>
              <div className="truncate text-2xs text-muted">{hint}</div>
            </div>
            <div className={`tabular shrink-0 text-sm font-semibold ${value === null ? 'text-line' : value < 0 ? 'text-wrong-700' : 'text-ink'}`}>
              {value === null ? '—' : `${value < 0 ? '− ' : ''}${rupees(Math.abs(value))}`}
            </div>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 bg-shell px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-ink">Net revenue</div>
            <div className="text-2xs text-muted">Service fee, less GST and gateway charges</div>
          </div>
          <div className="tabular text-lg font-bold text-ink">{rupees(revenue.netRevenue)}</div>
        </li>
      </ul>

      <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
        <Small label="Collected" value={rupees(revenue.collected.value)} delta={revenue.collected} />
        <Small label="Refunds" value={rupees(revenue.refunds.rupees)} sub={`${number(revenue.refunds.count)} refunded`} />
        <Small label="Settlements" value={null} sub="Not fetched yet" />
      </div>
    </div>
  );
}

function Small({ label, value, sub, delta }) {
  return (
    <div className="px-4 py-3">
      <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular mt-0.5 text-base font-bold ${value === null ? 'text-line' : 'text-ink'}`}>{value === null ? '—' : value}</div>
      {delta ? <Delta stat={delta} good="up" className="mt-1" /> : <div className="mt-1 text-2xs text-muted">{sub}</div>}
    </div>
  );
}

function SlotCard({ slot }) {
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{slot.slotLabel}</h3>
          <p className="text-2xs text-muted">
            {slot.placeName}
            {slot.isOpen ? '' : ` · closed${slot.closedNote ? `: ${slot.closedNote}` : ''}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-lg font-bold text-ink">{number(slot.available)}</div>
          <div className="text-2xs text-muted">of {number(slot.capacity)} left</div>
        </div>
      </div>

      <div className="mt-3"><Occupancy percent={slot.occupancyPercent} /></div>

      <table className="mt-3 w-full">
        <thead>
          <tr className="text-2xs uppercase tracking-wider text-muted">
            <th className="pb-1 text-left font-semibold">Type</th>
            <th className="pb-1 text-right font-semibold">Booked</th>
            <th className="pb-1 text-right font-semibold">Held</th>
            <th className="pb-1 text-right font-semibold">Capacity</th>
            <th className="pb-1 text-right font-semibold">Left</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {slot.categories.map((c) => (
            <tr key={c.code} className="text-sm">
              <td className="py-1.5 text-body">{c.label}</td>
              <td className="tabular py-1.5 text-right text-ink">{number(c.booked)}</td>
              <td className="tabular py-1.5 text-right text-muted">{number(c.held)}</td>
              <td className="tabular py-1.5 text-right text-muted">{number(c.capacity)}</td>
              <td className={`tabular py-1.5 text-right font-semibold ${c.available === 0 ? 'text-wrong-700' : 'text-ink'}`}>{number(c.available)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {[0, 1].map((g) => (
        <div key={g} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
      ))}
      <div className="card h-64 animate-pulse" />
    </div>
  );
}
