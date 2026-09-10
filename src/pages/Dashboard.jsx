/**
 * The page a Deputy Commissioner opens first.
 *
 * It answers four questions in the order they get asked:
 *
 *   How many vehicles came today, and how much was collected?
 *   How many attempts did the gate refuse, and why?
 *   How full is tomorrow?
 *   Is anything happening right now?
 *
 * The refusals sit high on the page on purpose. They are the reason this system
 * exists, and a week with eleven altered tickets caught is the single most
 * persuasive figure in any report to the department.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { rupees, num, shortDate, when, plate, verdict, toneClass, timeOnly } from '../lib/format';
import { PageHead, Section, Stat, Table, Loading, Pill, Fill } from '../components/ui';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let live = true;
    const load = () => api.get('/dashboard', { quiet: true })
      .then((r) => live && setD(r)).catch((e) => live && setErr(e.message));
    load();
    // A gate is a live thing; a dashboard that needs reloading during a demo
    // looks broken even when it is not.
    const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, []);

  if (err) return <div className="card p-6 text-sm text-refused">{err}</div>;
  if (!d) return <Loading what="Loading today's figures" />;

  const t = d.today || {};
  const y = d.yesterday || {};
  const tm = d.tomorrow || {};
  const g = d.gate || {};

  const delta = (a, b) => {
    if (!b) return null;
    const pct = Math.round(((a - b) / b) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}% on yesterday`;
  };

  return (
    <>
      <PageHead
        title={`Today · ${shortDate(t.date)}`}
        subtitle={d.place?.name}
      >
        <Link className="btn-ghost" to="/gate">Gate log</Link>
        <Link className="btn-primary" to="/revenue">Revenue</Link>
      </PageHead>

      {/* Today, in four numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Tickets today" value={num(t.tickets)}
              hint={delta(t.tickets, y.tickets) || 'first day of records'} />
        <Stat label="Collected today" value={rupees(t.gross_paise)}
              hint={`Department ${rupees(t.entry_paise)} · fee ${rupees(t.platform_paise)}`} />
        <Stat label="Entered the gate" value={num(g.valid)}
              tone="allowed"
              hint={`${num(t.tickets - (g.valid || 0))} yet to arrive`} />
        <Stat label="Refused at the gate" value={num(g.refused)}
              tone={g.refused ? 'refused' : undefined}
              hint={g.refused ? 'see the breakdown below' : 'nothing turned away today'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Why anything was refused */}
        <Section
          title="What the gate saw today"
          note="Every scan is recorded, including the ones it turned away."
          className="lg:col-span-1"
        >
          <ul className="space-y-2 mt-1">
            {['valid', 'already_used', 'invalid_signature', 'wrong_day', 'wrong_slot',
              'wrong_place', 'unknown_ticket', 'cancelled']
              .filter((k) => g[k])
              .map((k) => {
                const v = verdict(k);
                return (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <span className={`pill ${toneClass(v.tone)}`}>{v.label}</span>
                    <span className="tnum text-sm font-semibold text-ink-900">{num(g[k])}</span>
                  </li>
                );
              })}
            {!g.total && (
              <li className="text-sm text-ink-500 py-6 text-center">
                No scans yet today.
              </li>
            )}
          </ul>

          {g.already_used > 0 || g.invalid_signature > 0 ? (
            <div className="mt-4 rounded-md bg-refused-soft px-3 py-2.5 text-2xs text-refused leading-relaxed">
              <b>{num((g.already_used || 0) + (g.invalid_signature || 0))} attempt(s)</b> used a
              copied or altered ticket today. Under the old paper system these would have been
              waved through.
            </div>
          ) : null}
        </Section>

        {/* How full the day is */}
        <Section
          title="Capacity today"
          note="Booked and held, against each slot's limit."
          className="lg:col-span-2"
          right={<Link className="btn-ghost !py-1.5" to="/capacity">Manage</Link>}
        >
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-1">
            {(d.capacity || []).map((c) => (
              <div key={`${c.slot_code}-${c.category_code}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm text-ink-800">
                    <span className="font-medium">{c.category_label}</span>
                    <span className="text-ink-500"> · {c.slot_code === '0612' ? 'Morning' : 'Afternoon'}</span>
                  </div>
                  <div className="tnum text-2xs text-ink-500">
                    <b className="text-ink-900 text-sm">{num(c.booked)}</b> / {num(c.capacity)}
                  </div>
                </div>
                <div className="mt-1"><Fill booked={c.booked} held={c.held} capacity={c.capacity} /></div>
                {!c.is_open && (
                  <div className="mt-1 text-2xs text-refused">Closed — {c.closed_note || 'not open for booking'}</div>
                )}
              </div>
            ))}
            {!(d.capacity || []).length && (
              <div className="text-sm text-ink-500 py-6">No bookings opened for today yet.</div>
            )}
          </div>
        </Section>
      </div>

      {/* Tomorrow and the month */}
      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <Section title={`Tomorrow · ${shortDate(tm.date)}`} className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-4 mt-1">
            <div>
              <div className="label">Booked</div>
              <div className="text-2xl font-semibold tnum text-ink-900">{num(tm.tickets)}</div>
            </div>
            <div>
              <div className="label">Value</div>
              <div className="text-2xl font-semibold tnum text-ink-900">{rupees(tm.gross_paise)}</div>
            </div>
          </div>
          <p className="mt-3 text-2xs text-ink-500">
            Bookings for tomorrow are still open, so this figure will rise.
          </p>
        </Section>

        <Section title="This month so far" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-1">
            <div>
              <div className="label">Tickets</div>
              <div className="text-xl font-semibold tnum">{num(d.month?.tickets)}</div>
            </div>
            <div>
              <div className="label">Collected</div>
              <div className="text-xl font-semibold tnum">{rupees(d.month?.gross_paise)}</div>
            </div>
            <div>
              <div className="label">Department entry fee</div>
              <div className="text-xl font-semibold tnum text-forest-700">
                {rupees(d.month?.entry_paise)}
              </div>
            </div>
            <div>
              <div className="label">GST on booking fee</div>
              <div className="text-xl font-semibold tnum">{rupees(d.month?.gst_paise)}</div>
            </div>
          </div>
          <p className="mt-3 text-2xs text-ink-500 leading-relaxed">
            The entry fee is collected on behalf of the department as a pure agent under Rule 33 of
            the CGST Rules and is not part of ServerPe's taxable value. GST applies to the booking
            fee alone.
          </p>
        </Section>
      </div>

      {/* Live-ish feed */}
      <Section title="Latest bookings" className="mt-5"
               right={<Link className="btn-ghost !py-1.5" to="/bookings">All bookings</Link>}>
        <Table
          columns={[
            { key: 'ticket_no', label: 'Ticket',
              render: (r) => <span className="font-mono text-xs">{r.ticket_no}</span> },
            { key: 'reg_no', label: 'Vehicle',
              render: (r) => <span className="font-medium">{plate(r.reg_no)}</span> },
            { key: 'category_label', label: 'Type' },
            { key: 'travel_date', label: 'Travelling',
              render: (r) => `${shortDate(r.travel_date)} · ${r.slot_label?.split(' ')[0]}` },
            { key: 'status', label: 'Status',
              render: (r) => <Pill tone={r.status === 'used' ? 'forest' : 'allowed'}>
                {r.status === 'used' ? 'Entered' : 'Booked'}</Pill> },
            { key: 'total_paise', label: 'Paid', align: 'right',
              render: (r) => rupees(r.total_paise) },
            { key: 'created_at', label: 'Booked at', align: 'right',
              render: (r) => <span className="text-ink-500">{when(r.created_at)}</span> },
          ]}
          rows={d.recent || []}
          empty="No bookings yet."
        />
      </Section>
    </>
  );
}
