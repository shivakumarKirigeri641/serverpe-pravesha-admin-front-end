/**
 * Live monitoring — the screen left open on a desk all day.
 *
 * Two columns, because two different people care about two different things: an
 * officer watching collections wants the bookings feed, and anyone worried
 * about the gate wants the scan feed with its refusals in red.
 *
 * IT POLLS RATHER THAN PUSHES. A websocket would be tidier but adds a
 * connection to lose, a reconnect to write and a failure mode nobody notices
 * until the screen has been quietly frozen for an hour. A poll that fails is
 * visibly a poll that failed, and it recovers by itself.
 *
 * Each poll asks only for what has happened since the last one, so a page left
 * open from morning to evening never re-downloads the day.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, plate, timeOnly, when, verdict, toneClass } from '../lib/format';
import { PageHead, Section, Stat, Loading } from '../components/ui';

const POLL_MS = 4000;
const KEEP = 80;               // rows held in the feed before the oldest drop

export default function Live() {
  const [counters, setCounters] = useState(null);
  const [gates, setGates] = useState([]);
  const [scans, setScans] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [connected, setConnected] = useState(true);
  const [paused, setPaused] = useState(false);
  const [lastAt, setLastAt] = useState(null);

  const since = useRef(null);
  const seen = useRef(new Set());

  const poll = useCallback(async () => {
    try {
      const qs = since.current ? `?since=${encodeURIComponent(since.current)}` : '';
      const d = await api.get(`/live${qs}`, { quiet: true });

      setCounters(d.counters);
      setGates(d.gates || []);
      setConnected(true);
      setLastAt(new Date());

      // Ids are remembered so a row that arrives twice — which happens when a
      // poll overlaps the boundary — does not appear twice.
      const fresh = (list, key) => list.filter((r) => {
        const id = `${key}:${r.id}`;
        if (seen.current.has(id)) return false;
        seen.current.add(id);
        return true;
      });

      const newScans = fresh(d.scans || [], 'scan');
      const newBookings = fresh(d.bookings || [], 'booking');

      if (newScans.length) setScans((prev) => [...newScans, ...prev].slice(0, KEEP));
      if (newBookings.length) setBookings((prev) => [...newBookings, ...prev].slice(0, KEEP));

      since.current = d.now;
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    poll();
    if (paused) return undefined;
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll, paused]);

  if (!counters) return <Loading what="Connecting to the gate" />;

  const c = counters;
  const yetToArrive = Math.max(0, (c.booked_today || 0) - (c.entered_today || 0));

  return (
    <>
      <PageHead
        title="Live"
        subtitle={lastAt ? `Updated ${timeOnly(lastAt)}` : ' '}
      >
        <span className={`inline-flex items-center gap-2 text-xs font-medium ${
          connected ? 'text-allowed' : 'text-refused'}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${
            connected ? 'bg-allowed animate-pulse' : 'bg-refused'}`} />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
        <button className="btn-ghost !py-1.5" onClick={() => setPaused((v) => !v)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </PageHead>

      {/* Today, ticking */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat label="Booked today" value={num(c.booked_today)}
              hint={c.booked_last_hour ? `${num(c.booked_last_hour)} in the last hour` : 'none in the last hour'} />
        <Stat label="Entered the gate" value={num(c.entered_today)} tone="allowed"
              hint={`${num(yetToArrive)} yet to arrive`} />
        <Stat label="Collected today" value={rupees(c.collected_today)} />
        <Stat label="Scans today" value={num(c.scans_today)} />
        <Stat label="Refused today" value={num(c.refused_today)}
              tone={c.refused_today ? 'refused' : undefined}
              hint={c.refused_today ? 'see the feed' : 'nothing turned away'} />
      </div>

      {/* Who is on the gate right now */}
      <Section title="Gates" note="Who is signed in at this moment." className="mb-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gates.map((g) => (
            <div key={g.id} className={`rounded-lg border p-3.5 ${
              g.staff_name ? 'border-allowed/40 bg-allowed-soft/40' : 'border-ink-300/60 bg-paper-sunken'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-ink-900">{g.name}</div>
                <span className={`pill ${g.staff_name ? toneClass('allowed') : toneClass('muted')}`}>
                  {g.staff_name ? 'Manned' : 'Unmanned'}
                </span>
              </div>
              {g.staff_name ? (
                <>
                  <div className="mt-1.5 text-sm text-ink-800">{g.staff_name}</div>
                  <div className="mt-0.5 text-2xs text-ink-500">
                    {g.device_label} · on since {timeOnly(g.started_at)}
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="tnum text-lg font-semibold text-ink-900">
                      {num(g.scans_this_shift)}
                    </span>
                    <span className="text-2xs text-ink-500">
                      scans this shift
                      {g.last_scan_at && ` · last ${timeOnly(g.last_scan_at)}`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-1.5 text-2xs text-ink-500">
                  Nobody signed in. Tickets cannot be scanned at this gate.
                </div>
              )}
            </div>
          ))}
          {!gates.length && (
            <div className="text-sm text-ink-500 py-4">No checkposts configured.</div>
          )}
        </div>
      </Section>

      {/* The two feeds */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Scans as they happen"
                 note="Refusals are highlighted. Nothing here is filtered.">
          <Feed
            rows={scans}
            empty="Waiting for the first scan…"
            render={(s) => {
              const v = verdict(s.verdict);
              const bad = s.verdict !== 'valid';
              return (
                <li key={s.id}
                    className={`flex items-start justify-between gap-3 py-2.5 border-t
                                border-ink-300/40 first:border-0 ${bad ? '-mx-2 px-2 bg-refused-soft/50' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`pill ${toneClass(v.tone)}`}>{v.label}</span>
                      <span className="font-medium text-sm text-ink-900">
                        {plate(s.reg_no) || '—'}
                      </span>
                    </div>
                    <div className="mt-1 text-2xs text-ink-500 truncate">
                      {s.staff_name || 'unknown staff'} · {s.checkpost_name}
                      {s.was_offline && ' · offline'}
                      {s.ticket_no && ` · ${s.ticket_no}`}
                    </div>
                  </div>
                  <div className="text-2xs text-ink-500 whitespace-nowrap tnum">
                    {timeOnly(s.scanned_at)}
                  </div>
                </li>
              );
            }}
          />
        </Section>

        <Section title="Bookings as they happen"
                 note="Every ticket sold, newest first.">
          <Feed
            rows={bookings}
            empty="Waiting for the first booking…"
            render={(b) => (
              <li key={b.id}
                  className="flex items-start justify-between gap-3 py-2.5 border-t
                             border-ink-300/40 first:border-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xs text-ink-500">{b.ticket_no}</span>
                    <span className="font-medium text-sm text-ink-900">{plate(b.reg_no)}</span>
                  </div>
                  <div className="mt-1 text-2xs text-ink-500 truncate">
                    {b.category_label} · travelling {String(b.travel_date).slice(0, 10)} ·{' '}
                    {b.slot_label}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="tnum text-sm font-semibold text-ink-900">
                    {rupees(b.total_paise)}
                  </div>
                  <div className="text-2xs text-ink-500">{timeOnly(b.created_at)}</div>
                </div>
              </li>
            )}
          />
        </Section>
      </div>
    </>
  );
}

/** A capped, scrolling list. Fixed height so the page never jumps. */
function Feed({ rows, render, empty }) {
  if (!rows.length) {
    return (
      <div className="h-[26rem] flex items-center justify-center text-sm text-ink-400">
        {empty}
      </div>
    );
  }
  return (
    <ul className="h-[26rem] overflow-y-auto -mx-1 px-1">
      {rows.map(render)}
    </ul>
  );
}
