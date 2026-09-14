import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import usePulse from '../lib/usePulse';
import { useSession, can } from '../lib/session';
import { clock, dayLabel, number, percent, plate } from '../lib/format';

/*
 * Negative tracking — suspicious and invalid activity, with its full story.
 *
 * Built to answer three questions, in the order a person asks them:
 *
 *   1. Is something going on right now?   Live counters, each ticking up with a
 *      "+N" when a new event lands, and today against yesterday at this hour.
 *   2. Who keeps doing it?                  Vehicles and visitors past the
 *      threshold, and the booking-abuse patterns, above the feed rather than
 *      buried in it.
 *   3. What exactly happened?               Every event with the pass, the
 *      booking, the vehicle's last valid entry, who checked it, which attempt
 *      it was, and what was done about it — and a profile with the whole history.
 *
 * DECISIONS ARE RECORDED, NOT REMEMBERED. Reviewing, dismissing, escalating,
 * a note, blocking a number: each is written against the thing reviewed, with a
 * name and a time, and blocking needs a reason.
 */

const POLL_MS = 15000;

const TONE = {
  wrong: { chip: 'bg-wrong-50 text-wrong-700', bar: 'bg-wrong-500', text: 'text-wrong-700' },
  watch: { chip: 'bg-watch-50 text-watch-700', bar: 'bg-watch-500', text: 'text-watch-700' },
  none: { chip: 'bg-shell text-muted', bar: 'bg-line', text: 'text-muted' },
};

export default function Negative() {
  const { me } = useSession();
  const [overview, setOverview] = useState(null);
  const [bumps, setBumps] = useState({});
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ category: '', q: '', from: '', to: '' });
  const [feed, setFeed] = useState(null);
  const [cursors, setCursors] = useState([null]);
  const [page, setPage] = useState(0);
  const [profile, setProfile] = useState(null);   // { type: 'vehicle'|'visitor', id }
  const previous = useRef(null);

  const loadOverview = useCallback(async () => {
    try {
      const d = await api.negative();
      /* "+N" per category: what arrived since the last look. */
      if (previous.current) {
        const next = {};
        d.categories.forEach((c) => {
          const was = previous.current.find((p) => p.key === c.key);
          if (was && typeof c.value === 'number' && typeof was.value === 'number' && c.value > was.value) next[c.key] = c.value - was.value;
        });
        setBumps(next);
      }
      previous.current = d.categories;
      setOverview(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadFeed = useCallback(async (pageIndex = 0, cursorList = [null]) => {
    try {
      const d = await api.negativeEvents({ ...filter, before: cursorList[pageIndex] || null, limit: 25 });
      setFeed(d);
      if (d.nextCursor && cursorList.length === pageIndex + 1) setCursors([...cursorList, d.nextCursor]);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [filter]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  /* A refusal at a gate lands here within seconds, not at the next 15-second poll. */
  usePulse(loadOverview);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadOverview(); }, POLL_MS);
    return () => clearInterval(id);
  }, [loadOverview]);

  /* A new filter starts the feed again from the newest event. */
  useEffect(() => {
    const id = setTimeout(() => { setPage(0); setCursors([null]); loadFeed(0, [null]); }, filter.q ? 350 : 0);
    return () => clearTimeout(id);
  }, [filter, loadFeed]);

  const goPage = (next) => { setPage(next); loadFeed(next, cursors); };
  const canOperate = can(me, 'negative.act');
  const canBlock = can(me, 'visitors.block');

  return (
    <Shell
      title="Negative tracking — suspicious and invalid activity"
      subtitle={overview ? `Live · today until ${overview.cutAt} IST against yesterday at the same time` : 'Loading…'}
    >
      {error && <div className="mb-4 rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-2.5 text-sm font-medium text-wrong-700">{error}</div>}
      {!overview && !error && <div className="card h-64 animate-pulse" />}

      {overview && (
        <div className="space-y-6">
          <Headline overview={overview} bumps={bumps} />
          <Categories overview={overview} bumps={bumps} active={filter.category}
            onPick={(key) => setFilter((f) => ({ ...f, category: f.category === key ? '' : key }))} />
          <Suspects overview={overview} onOpen={setProfile} />

          <section>
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Events</h2>
              <span className="text-2xs text-muted">Newest first · click a vehicle or visitor for their history</span>
            </div>

            <div className="card mb-3 flex flex-wrap items-end gap-3 p-3">
              <div className="min-w-[220px] flex-1">
                <div className="label">Search</div>
                <input className="input !py-2" placeholder="Vehicle, pass number, mobile or name" value={filter.q}
                  onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
              </div>
              <div>
                <div className="label">Category</div>
                <select className="input !w-auto !py-2" value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">All categories</option>
                  {overview.categories.filter((c) => typeof c.value === 'number' && !['repeat', 'suspicious', 'booking_abuse'].includes(c.key))
                    .map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <div className="label">From – to</div>
                <div className="flex items-center gap-1.5">
                  <input type="date" className="input !w-auto !py-2" max={overview.date} value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} />
                  <span className="text-muted">–</span>
                  <input type="date" className="input !w-auto !py-2" max={overview.date} value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} />
                </div>
              </div>
              {(filter.q || filter.category || filter.from || filter.to) && (
                <button type="button" className="btn-quiet !py-2" onClick={() => setFilter({ category: '', q: '', from: '', to: '' })}>Clear</button>
              )}
            </div>

            <EventTable feed={feed} onOpen={setProfile} />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-2xs text-muted">Page {page + 1}</span>
              <div className="flex gap-2">
                <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" disabled={page === 0} onClick={() => goPage(page - 1)}>‹ Newer</button>
                <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" disabled={!feed?.hasMore} onClick={() => goPage(page + 1)}>Older ›</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {profile && (
        <ProfileDrawer profile={profile} canOperate={canOperate} canBlock={canBlock} onClose={() => setProfile(null)}
          onChanged={() => { loadOverview(); loadFeed(page, cursors); }} />
      )}
    </Shell>
  );
}

function Headline({ overview, bumps }) {
  const s = overview.suspiciousAttempts;
  const up = s.direction === 'up';
  const bumped = Object.entries(bumps);
  return (
    <div className="card flex flex-wrap items-center gap-5 p-5">
      <div className={`grid h-14 w-14 place-items-center rounded-2xl text-2xl ${up ? 'bg-wrong-50' : 'bg-good-50'}`} aria-hidden>
        {up ? '⚠️' : '🛡️'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Suspicious attempts today</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <span className="tabular text-4xl font-bold text-ink">{number(s.value)}</span>
          <span className={`text-sm font-semibold ${s.direction === 'flat' ? 'text-muted' : up ? 'text-wrong-700' : 'text-good-700'}`}>
            {s.percent === null ? (s.value ? 'none yesterday by now' : 'none yesterday either')
              : `${percent(s.percent)} vs yesterday (${number(s.previous)} by this time)`}
          </span>
        </div>
        <div className="mt-1 text-2xs text-muted">Invalid, duplicate, expired, early, unpaid and wrong-destination passes, and failed payments.</div>
      </div>
      {bumped.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bumped.map(([key, n]) => {
            const c = overview.categories.find((x) => x.key === key);
            return <span key={key} className="chip animate-pulse bg-wrong-500 text-white">{c?.label.toUpperCase()} +{n}</span>;
          })}
        </div>
      )}
    </div>
  );
}

function Categories({ overview, bumps, active, onPick }) {
  const clickable = (c) => typeof c.value === 'number' && !['repeat', 'suspicious', 'booking_abuse'].includes(c.key);
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">By category</h2>
        <span className="text-2xs text-muted">Click a category to filter the events below</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {overview.categories.map((c) => {
          const tone = TONE[c.tone] || TONE.none;
          const isActive = active === c.key;
          const Tag = clickable(c) ? 'button' : 'div';
          return (
            <Tag key={c.key} type={clickable(c) ? 'button' : undefined} onClick={clickable(c) ? () => onPick(c.key) : undefined}
              title={c.note || undefined}
              className={`card relative overflow-hidden p-3.5 text-left transition ${clickable(c) ? 'hover:shadow-pop' : ''} ${isActive ? 'ring-2 ring-brand' : ''} ${c.value === null ? 'border-dashed' : ''}`}>
              <span className={`absolute inset-y-0 left-0 w-1 ${c.value === null ? 'bg-line' : tone.bar}`} />
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{c.label}</span>
                {bumps[c.key] && <span className="chip bg-wrong-500 text-white">+{bumps[c.key]}</span>}
              </div>
              <div className={`tabular mt-1.5 text-2xl font-bold leading-none ${c.value === null ? 'text-line' : 'text-ink'}`}>
                {c.value === null ? '—' : number(c.value)}
              </div>
              <div className="mt-1.5 text-2xs text-muted">
                {c.value === null ? 'Not measured'
                  : c.previous === null || c.previous === undefined ? (c.key === 'suspicious' ? 'in the last 7 days' : 'last 7 days')
                    : <Delta c={c} />}
              </div>
            </Tag>
          );
        })}
      </div>
    </section>
  );
}

function Delta({ c }) {
  if (c.direction === 'flat') return <>same as yesterday ({number(c.previous)})</>;
  if (c.percent === null) return <>none yesterday</>;
  return (
    <span className={c.direction === 'up' ? 'font-semibold text-wrong-700' : 'font-semibold text-good-700'}>
      {c.direction === 'up' ? '▲' : '▼'} {percent(c.percent)} <span className="font-normal text-muted">vs {number(c.previous)}</span>
    </span>
  );
}

function Suspects({ overview, onOpen }) {
  const { vehicles, visitors } = overview.suspects;
  const th = overview.thresholds;
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <div className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-line bg-wrong-50/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-wrong-700">Suspicious vehicles</h3>
          <span className="text-2xs text-muted">{th.attempts}+ refusals in {th.windowDays} days</span>
        </div>
        {vehicles.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">None.</p> : (
          <ul className="divide-y divide-line">
            {vehicles.map((v) => (
              <li key={v.regNo}>
                <button type="button" onClick={() => onOpen({ type: 'vehicle', id: v.regNo })} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-shell">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold text-ink">{plate(v.regNo)}</div>
                    <div className="truncate text-2xs text-muted">{v.vehicle || v.type || 'Unknown vehicle'} · last {dayLabel(new Date(v.lastAt).toISOString().slice(0, 10))}</div>
                  </div>
                  <span className="chip shrink-0 bg-wrong-500 text-white">{v.attempts} attempts</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-line bg-wrong-50/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-wrong-700">Suspicious visitors</h3>
          <span className="text-2xs text-muted">Failures across booking, payment and gate</span>
        </div>
        {visitors.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">None.</p> : (
          <ul className="divide-y divide-line">
            {visitors.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => onOpen({ type: 'visitor', id: v.id })} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-shell">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{v.name || v.mobile}{v.blocked && <span className="ml-2 chip bg-ink text-white">Blocked</span>}</div>
                    <div className="truncate text-2xs text-muted">
                      {[v.paymentFailures && `${v.paymentFailures} failed payments`, v.abandonedHolds && `${v.abandonedHolds} abandoned holds`, v.gateRefusals && `${v.gateRefusals} gate refusals`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="chip shrink-0 bg-wrong-500 text-white">{v.attempts} attempts</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-line bg-wrong-50/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-wrong-700">Booking abuse</h3>
          <span className="text-2xs text-muted">Patterns in the last 7 days</span>
        </div>
        {overview.abuse.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">None.</p> : (
          <ul className="divide-y divide-line">
            {overview.abuse.map((a, i) => (
              <li key={i}>
                <button type="button" onClick={() => onOpen({ type: 'visitor', id: a.visitor.id })} className="w-full px-4 py-2.5 text-left hover:bg-shell">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{a.visitor.name || a.visitor.mobile}</span>
                    <span className="shrink-0 text-2xs text-muted">{dayLabel(a.day)}</span>
                  </div>
                  <div className="text-2xs text-wrong-700">{a.label}</div>
                  <div className="truncate font-mono text-2xs text-muted">{a.vehicles.map(plate).join(', ')}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EventTable({ feed, onOpen }) {
  const [open, setOpen] = useState(null);
  if (!feed) return <div className="card h-40 animate-pulse" />;
  if (!feed.events.length) return <p className="card px-4 py-10 text-center text-sm text-muted">No events match.</p>;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1100px]">
        <thead className="border-b border-line bg-shell">
          <tr>
            <th className="th">Date · time</th><th className="th">Category</th><th className="th">Vehicle</th><th className="th">Pass</th>
            <th className="th">Visitor</th><th className="th text-right">Attempt</th><th className="th">Checked by</th>
            <th className="th">Reason</th><th className="th">Action</th><th className="th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {feed.events.map((e) => {
            const tone = TONE[e.tone] || TONE.none;
            const isOpen = open === e.key;
            return (
              <FragmentRow key={e.key}>
                <tr className={`align-top ${e.suspicious ? 'bg-wrong-50/40' : ''}`}>
                  <td className="td whitespace-nowrap">
                    <div className="text-ink">{dayLabel(new Date(e.at).toISOString().slice(0, 10))}</div>
                    <div className="tabular text-2xs text-muted">{clock(e.at)}</div>
                  </td>
                  <td className="td">
                    <span className={`chip ${tone.chip}`}>{e.categoryLabel}</span>
                    {e.suspicious && <div className="mt-1"><span className="chip bg-wrong-500 text-white">Suspicious</span></div>}
                  </td>
                  <td className="td">
                    {e.regNo ? (
                      <button type="button" className="text-left" onClick={() => onOpen({ type: 'vehicle', id: e.regNo })}>
                        <div className="font-mono text-sm font-semibold text-brand-light hover:underline">{plate(e.regNo)}</div>
                        <div className="text-2xs text-muted">{e.vehicleType || '—'}</div>
                      </button>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="td font-mono text-2xs text-muted">{e.ticketNo || '—'}</td>
                  <td className="td">
                    {e.visitor ? (
                      <button type="button" className="text-left" onClick={() => onOpen({ type: 'visitor', id: e.visitor.id })}>
                        <div className="text-sm text-brand-light hover:underline">{e.visitor.name || '—'}</div>
                        <div className="font-mono text-2xs text-muted">{e.visitor.mobile}{e.visitor.blocked ? ' · blocked' : ''}</div>
                      </button>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="td tabular text-right">
                    <span className={e.attemptNo > 1 ? 'font-semibold text-wrong-700' : 'text-body'}>{e.attemptNo || '—'}</span>
                    {e.windowAttempts > 1 && <div className="text-2xs text-muted">{e.windowAttempts} in 7d</div>}
                  </td>
                  <td className="td">
                    <div className="text-sm text-body">{e.staff || '—'}</div>
                    <div className="text-2xs text-muted">{e.checkpost || (e.kind === 'payment' ? 'Payment page' : '')}</div>
                  </td>
                  <td className="td max-w-[260px] text-2xs text-body">{e.reason}</td>
                  <td className="td">
                    <div className="text-2xs text-body">{e.action}</div>
                    {e.reviewed && <div className="mt-1 chip bg-brand/10 text-brand" title={e.reviewed.note || ''}>{e.reviewed.action} · {e.reviewed.by || '—'}</div>}
                  </td>
                  <td className="td">
                    <button type="button" className="text-2xs font-semibold text-brand-light hover:underline" onClick={() => setOpen(isOpen ? null : e.key)}>
                      {isOpen ? 'Less' : 'Details'}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-shell/60">
                    <td className="td" colSpan={10}>
                      <div className="grid gap-4 text-sm sm:grid-cols-3">
                        <Detail label="Previous valid entry" value={e.previousEntry ? new Date(e.previousEntry).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'None recorded'} />
                        <Detail label="Original booking" value={e.booking
                          ? (e.booking.travelDate ? `${dayLabel(e.booking.travelDate)} · ${e.booking.slot} · ${e.booking.place} · ₹${e.booking.amount} · ${e.booking.status}` : `₹${e.booking.amount} · order ${e.booking.order || '—'}`)
                          : 'No booking behind this attempt'} />
                        <Detail label="Booked at" value={e.booking?.bookedAt ? new Date(e.booking.bookedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} />
                        <Detail label="Vehicle" value={e.vehicle || e.vehicleType || '—'} />
                        <Detail label="Check took" value={e.durationMs ? `${(e.durationMs / 1000).toFixed(1)} sec` : '—'} />
                        <Detail label="Review" value={e.reviewed ? `${e.reviewed.action} by ${e.reviewed.by || '—'}${e.reviewed.note ? ` — ${e.reviewed.note}` : ''}` : 'Not reviewed'} />
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const FragmentRow = ({ children }) => <>{children}</>;
const Detail = ({ label, value }) => (
  <div><div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div><div className="mt-0.5 text-ink">{value}</div></div>
);

/** A vehicle's or visitor's whole history, and the actions available. */
function ProfileDrawer({ profile, canOperate, canBlock, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const call = profile.type === 'vehicle' ? api.negativeVehicle(profile.id) : api.negativeVisitor(profile.id);
    return call.then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, [profile]);

  useEffect(() => { setData(null); load(); }, [load]);

  async function act(action) {
    setBusy(true);
    try {
      await api.negativeReview({ subjectType: profile.type === 'vehicle' ? 'vehicle' : 'customer', subjectId: profile.id, action, note: note.trim() || null });
      setNote('');
      await load();
      onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function block(blocked) {
    setBusy(true);
    try {
      await api.negativeBlock(profile.id, { blocked, reason: reason.trim() });
      setReason('');
      await load();
      onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const events = data?.events || [];
  const title = profile.type === 'vehicle' ? plate(profile.id) : (data?.visitor?.name || 'Visitor');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div className="min-w-0">
            <div className={`truncate text-lg font-bold text-ink ${profile.type === 'vehicle' ? 'font-mono' : ''}`}>{title}</div>
            <div className="text-2xs text-muted">
              {profile.type === 'vehicle'
                ? [data?.vehicle?.maker, data?.vehicle?.model, data?.vehicle?.category].filter(Boolean).join(' · ') || 'Vehicle'
                : data?.visitor && `${data.visitor.mobile} · ${data.visitor.passes} passes · ${data.visitor.visits} visits · ${data.visitor.vehicles} vehicles`}
            </div>
          </div>
          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={onClose}>Close</button>
        </div>

        {error && <p className="m-5 rounded-lg bg-wrong-50 px-4 py-3 text-sm text-wrong-700">{error}</p>}
        {!data && !error && <div className="m-5 h-48 animate-pulse rounded-lg bg-shell" />}

        {data && (
          <div className="space-y-5 p-5">
            {data.suspicious && (
              <div className="rounded-xl border border-wrong-500/30 bg-wrong-50 px-4 py-3">
                <div className="text-sm font-bold text-wrong-700">⚠️ {data.recentFailures} suspicious attempts detected</div>
                <div className="text-2xs text-wrong-700/80">In the last {data.thresholds.windowDays} days — the threshold is {data.thresholds.attempts}.</div>
              </div>
            )}
            {data.visitor?.blocked && (
              <div className="rounded-xl border border-ink/20 bg-ink px-4 py-3 text-white">
                <div className="text-sm font-bold">This number is blocked</div>
                <div className="text-2xs text-white/70">{data.visitor.blockedReason || 'No reason recorded'} · messages are received but not answered, so it cannot book.</div>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">History</h4>
              {events.length === 0 && !data.abandonedHolds?.length ? <p className="text-sm text-muted">No negative events.</p> : (
                <ol className="relative space-y-3 border-l-2 border-line pl-5">
                  {events.map((e) => (
                    <li key={e.key} className="relative">
                      <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${(TONE[e.tone] || TONE.none).bar}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`chip ${(TONE[e.tone] || TONE.none).chip}`}>{e.categoryLabel}</span>
                        <span className="text-2xs text-muted">{new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {e.attemptNo > 1 && <span className="chip bg-wrong-500 text-white">attempt {e.attemptNo} that day</span>}
                      </div>
                      <div className="mt-0.5 text-sm text-body">{e.reason}</div>
                      <div className="text-2xs text-muted">
                        {[e.ticketNo, e.regNo && plate(e.regNo), e.staff && `checked by ${e.staff}`, e.action].filter(Boolean).join(' · ')}
                      </div>
                    </li>
                  ))}
                  {(data.abandonedHolds || []).map((h) => (
                    <li key={h.ticketNo} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-watch-500 ring-4 ring-white" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip bg-watch-50 text-watch-700">Abandoned hold</span>
                        <span className="text-2xs text-muted">{new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <div className="text-2xs text-muted">{h.ticketNo} · {plate(h.regNo)} · for {dayLabel(h.travelDate)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {data.validEntries && (
              <div>
                <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">Valid entries</h4>
                {data.validEntries.length === 0 ? <p className="text-sm text-muted">This vehicle has never been admitted.</p> : (
                  <ul className="space-y-1 text-sm">
                    {data.validEntries.slice(0, 8).map((v) => (
                      <li key={v.ticketNo} className="flex justify-between gap-3">
                        <span className="text-ink">{new Date(v.enteredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        <span className="text-2xs text-muted">{v.ticketNo} · {v.visitor || '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">Decisions</h4>
              {data.reviews.length === 0 ? <p className="text-sm text-muted">Nothing recorded yet.</p> : (
                <ul className="space-y-1.5 text-sm">
                  {data.reviews.map((r, i) => (
                    <li key={i} className="rounded-lg bg-shell px-3 py-2">
                      <span className="font-semibold capitalize text-ink">{r.action}</span>
                      <span className="text-2xs text-muted"> · {r.by || '—'} · {new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {r.note && <div className="text-body">{r.note}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canOperate ? (
              <div className="space-y-3 rounded-xl border border-line p-4">
                <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted">Record a decision</h4>
                <textarea className="input min-h-[70px]" placeholder="Note (what you checked, what you decided)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-quiet" disabled={busy} onClick={() => act('reviewed')}>Mark reviewed</button>
                  <button type="button" className="btn-quiet" disabled={busy} onClick={() => act('dismissed')}>Dismiss</button>
                  <button type="button" className="btn-quiet !text-wrong-700" disabled={busy} onClick={() => act('escalated')}>Escalate</button>
                  <button type="button" className="btn-quiet" disabled={busy || !note.trim()} onClick={() => act('note')}>Add note</button>
                </div>

                {profile.type === 'visitor' && canBlock && (
                  <div className="border-t border-line pt-3">
                    {data.visitor.blocked ? (
                      <button type="button" className="btn-quiet" disabled={busy} onClick={() => block(false)}>Unblock this number</button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="input flex-1" placeholder="Reason for blocking (required)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                        <button type="button" className="btn bg-ink text-white hover:bg-ink/90" disabled={busy || reason.trim().length < 5} onClick={() => block(true)}>Block number</button>
                      </div>
                    )}
                    <p className="mt-1.5 text-2xs text-muted">Blocking stops new bookings. It does not cancel a pass already paid for.</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-2xs text-muted">Your role can view this history but not record decisions.</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
