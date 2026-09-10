/**
 * The next fortnight, as it fills.
 *
 * A dashboard says what happened. This says what is *about* to happen, which is
 * what someone rostering staff or planning a closure actually needs: how full
 * each of the coming days is, which day is filling fastest, and who has booked
 * in the last few minutes.
 *
 * Refreshes on its own, because the number that matters here changes while you
 * are looking at it.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, when, plate, timeOnly } from '../lib/format';
import { PageHead, Section, Stat, Table, Pill, Loading, Fill } from '../components/ui';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';

const GRID = '#e6eae8';
const AXIS = { fontSize: 11, fill: '#6b7975' };
const TIP = { fontSize: 12, borderRadius: 8, border: '1px solid #c2ccc8' };
const POLL_MS = 15000;

export default function Upcoming() {
  const [d, setD] = useState(null);
  const [occ, setOcc] = useState([]);
  const [at, setAt] = useState(null);

  const load = useCallback(async () => {
    const [u, a] = await Promise.all([
      api.get('/upcoming?days=14', { quiet: true }),
      api.get(`/analytics?from=${new Date().toISOString().slice(0, 10)}&to=${
        new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}`, { quiet: true }),
    ]);
    setD(u); setOcc(a.occupancy || []); setAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!d) return <Loading what="Loading the coming fortnight" />;

  /* Fold the per-slot rows into one row per day. */
  const days = {};
  for (const r of d.byDate) {
    const k = String(r.travel_date).slice(0, 10);
    days[k] = days[k] || { date: k, tickets: 0, gross_paise: 0, customers: 0, slots: {} };
    days[k].tickets += r.tickets;
    days[k].gross_paise += r.gross_paise;
    days[k].customers += r.customers;
    days[k].slots[r.slot_code] = r.tickets;
  }
  const list = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  const occFor = (date) => occ.find((o) => String(o.date).slice(0, 10) === date);

  const total = list.reduce((n, x) => n + x.tickets, 0);
  const value = list.reduce((n, x) => n + x.gross_paise, 0);
  const busiest = list.reduce((a, x) => (!a || x.tickets > a.tickets ? x : a), null);

  return (
    <>
      <PageHead title="Upcoming bookings"
                subtitle={at ? `The next fortnight · updated ${timeOnly(at)}` : ' '} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Booked, next 14 days" value={num(total)} />
        <Stat label="Value held" value={rupees(value)} />
        <Stat label="Busiest day"
              value={busiest ? shortDate(busiest.date) : '—'}
              hint={busiest ? `${num(busiest.tickets)} tickets` : ''} />
        <Stat label="Days with bookings" value={num(list.length)}
              hint="of the next 14" />
      </div>

      <Section title="How the coming days are filling"
               note="Morning and afternoon, side by side."
               className="mb-5">
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={list.map((x) => ({
              date: shortDate(x.date).replace(', ', ' '),
              Morning: x.slots['0612'] || 0,
              Afternoon: x.slots['1206'] || 0,
            }))}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={TIP} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Morning" stackId="a" fill="#0f766e" />
              <Bar dataKey="Afternoon" stackId="a" fill="#5cc4b8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!list.length && (
          <p className="text-center text-sm text-ink-500 -mt-40 pb-40">
            Nothing booked for the coming fortnight yet.
          </p>
        )}
      </Section>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Day by day">
          <Table
            columns={[
              { key: 'date', label: 'Date',
                render: (r) => (
                  <div>
                    <div className="font-medium">{shortDate(r.date)}</div>
                    <div className="text-2xs text-ink-500">
                      {daysToGo(r.date)}
                    </div>
                  </div>
                ) },
              { key: 'tickets', label: 'Tickets', align: 'right',
                render: (r) => <b>{num(r.tickets)}</b> },
              { key: 'slots', label: 'AM / PM', align: 'right',
                render: (r) => (
                  <span className="text-ink-600">
                    {num(r.slots['0612'] || 0)} / {num(r.slots['1206'] || 0)}
                  </span>
                ) },
              { key: 'fill', label: 'How full', className: 'w-40',
                render: (r) => {
                  const o = occFor(r.date);
                  if (!o) return <span className="text-ink-400 text-xs">—</span>;
                  return (
                    <div>
                      <Fill booked={o.booked} held={0} capacity={o.capacity} />
                      <div className="text-2xs text-ink-500 mt-0.5 tnum">{o.pct}% full</div>
                    </div>
                  );
                } },
              { key: 'gross_paise', label: 'Value', align: 'right',
                render: (r) => rupees(r.gross_paise) },
            ]}
            rows={list}
            empty="Nothing booked yet."
          />
        </Section>

        <Section title="Just booked" note="Newest first, refreshing on its own.">
          <ul className="divide-y divide-ink-300/40 max-h-[26rem] overflow-y-auto">
            {d.latest.map((b) => (
              <li key={b.ticket_no} className="py-2.5 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{plate(b.reg_no)}</span>
                      <span className="font-mono text-2xs text-ink-500">{b.ticket_no}</span>
                      {b.has_qr
                        ? <Pill tone="allowed">QR issued</Pill>
                        : <Pill tone="pending">Awaiting payment</Pill>}
                    </div>
                    <div className="mt-1 text-2xs text-ink-500 truncate">
                      {b.wa_profile_name || 'Visitor'} · {b.mobile} · {b.category_label}
                    </div>
                    <div className="mt-0.5 text-2xs text-ink-600">
                      Travelling {shortDate(b.travel_date)} · {b.slot_label} ·{' '}
                      <b>{b.days_to_go > 0 ? `${b.days_to_go} days to go`
                        : b.days_to_go === 0 ? 'today' : 'past'}</b>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="tnum text-sm font-semibold">{rupees(b.total_paise)}</div>
                    <div className="text-2xs text-ink-500">{when(b.created_at)}</div>
                  </div>
                </div>
              </li>
            ))}
            {!d.latest.length && (
              <li className="py-10 text-center text-sm text-ink-500">No bookings yet.</li>
            )}
          </ul>
        </Section>
      </div>
    </>
  );
}

function daysToGo(date) {
  const d = Math.round((new Date(`${date}T00:00:00`) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}
