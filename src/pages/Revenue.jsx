/**
 * The money, split three ways and kept split.
 *
 * The department's entry fee is not revenue — it passes through our account as
 * a pure agent under Rule 33 of the CGST Rules. Presenting one "total revenue"
 * figure to a government officer would be both wrong and, in a room where
 * settlement is being discussed, actively misleading. So the three columns
 * never merge.
 *
 * The gateway fee is an estimate from a configured percentage. It is labelled
 * as an estimate everywhere it appears — a number shown to a DC must never look
 * more precise than it is.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, daysAgo, today } from '../lib/format';
import { PageHead, Section, Stat, Table, Loading } from '../components/ui';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const PRESETS = [
  ['Last 7 days', 7], ['Last 30 days', 30], ['Last 90 days', 90],
];

export default function Revenue() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api.get(`/revenue?from=${from}&to=${to}`, { quiet: true }).then(setD);
  }, [from, to]);

  const t = d?.totals || {};

  return (
    <>
      <PageHead title="Revenue & GST"
                subtitle={`${shortDate(from)} to ${shortDate(to)}`}>
        {PRESETS.map(([label, days]) => (
          <button key={days} className="btn-ghost !py-1.5"
                  onClick={() => { setFrom(daysAgo(days)); setTo(today()); }}>
            {label}
          </button>
        ))}
        <button className="btn-primary"
                onClick={() => api.download(`/export/revenue?from=${from}&to=${to}`,
                  `revenue-${from}-to-${to}.csv`)}>
          Download CSV
        </button>
      </PageHead>

      <Section className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label><div className="label">From</div>
            <input type="date" className="input mt-1" value={from}
                   onChange={(e) => setFrom(e.target.value)} /></label>
          <label><div className="label">To</div>
            <input type="date" className="input mt-1" value={to}
                   onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </Section>

      {!d ? <Loading what="Working out the figures" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Tickets" value={num(t.tickets)}
                  hint={`${num(d.refunds?.n)} refunded`} />
            <Stat label="Total collected" value={rupees(t.gross_paise)}
                  hint="everything charged to visitors" />
            <Stat label="Department's entry fee" value={rupees(t.entry_paise)}
                  hint="collected as pure agent — not our revenue" />
            <Stat label="Our take-home (est.)" value={rupees(t.take_home_paise)}
                  tone="allowed"
                  hint="booking fee less GST and gateway charges" />
          </div>

          <Section title="Collections by day"
                   note="The department's entry fee and our booking fee, stacked."
                   className="mb-5">
            <div className="h-72 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(d.days || []).map((x) => ({
                  date: shortDate(x.date).replace(', ', ' '),
                  entry: x.entry_paise / 100,
                  fee: x.platform_paise / 100,
                }))}>
                  <CartesianGrid stroke="#e6eae8" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7975' }}
                         tickLine={false} axisLine={{ stroke: '#e6eae8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7975' }} tickLine={false}
                         axisLine={false} width={56}
                         tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                  <Tooltip
                    formatter={(v, n) => [`₹${Number(v).toLocaleString('en-IN')}`,
                      n === 'entry' ? 'Department entry fee' : 'Booking fee']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #c2ccc8' }} />
                  <Legend formatter={(v) => v === 'entry' ? 'Department entry fee' : 'Booking fee'}
                          wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entry" stackId="a" fill="#0f766e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="fee" stackId="a" fill="#19a396" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            <Section title="Where the money goes" className="lg:col-span-1">
              <dl className="space-y-2 text-sm">
                <Line k="Collected from visitors" v={t.gross_paise} bold />
                <Line k="Paid to the department" v={t.entry_paise} minus />
                <div className="border-t border-ink-300/50 pt-2">
                  <Line k="Our booking fee" v={t.platform_paise} />
                  <Line k="GST within it" v={t.gst_paise} minus muted />
                  <Line k="Gateway charges (est.)" v={t.gateway_fee_paise} minus muted />
                </div>
                <div className="border-t border-ink-300/50 pt-2">
                  <Line k="Take-home (est.)" v={t.take_home_paise} bold />
                </div>
              </dl>
              <p className="mt-3 text-2xs text-ink-500 leading-relaxed">
                {d.assumptions?.note} The gateway charges {d.assumptions?.gateway_fee_percent}% plus
                GST on the whole amount collected, including the department's share.
              </p>
            </Section>

            <Section title="By vehicle type" className="lg:col-span-1">
              <Table
                columns={[
                  { key: 'label', label: 'Type' },
                  { key: 'tickets', label: 'Tickets', align: 'right',
                    render: (r) => num(r.tickets) },
                  { key: 'gross_paise', label: 'Collected', align: 'right',
                    render: (r) => rupees(r.gross_paise) },
                ]}
                rows={d.categories || []}
                empty="No tickets in this period."
              />
            </Section>

            <Section title="By slot" className="lg:col-span-1"
                     note="Whether the day is split in the right place.">
              <Table
                columns={[
                  { key: 'label', label: 'Slot',
                    render: (r) => r.code === '0612' ? 'Morning' : 'Afternoon' },
                  { key: 'tickets', label: 'Tickets', align: 'right',
                    render: (r) => num(r.tickets) },
                  { key: 'gross_paise', label: 'Collected', align: 'right',
                    render: (r) => rupees(r.gross_paise) },
                ]}
                rows={d.slots || []}
                empty="No tickets in this period."
              />
            </Section>
          </div>

          <Section title="Day by day">
            <Table
              columns={[
                { key: 'date', label: 'Date', render: (r) => shortDate(r.date) },
                { key: 'tickets', label: 'Tickets', align: 'right', render: (r) => num(r.tickets) },
                { key: 'gross_paise', label: 'Collected', align: 'right',
                  render: (r) => rupees(r.gross_paise) },
                { key: 'entry_paise', label: 'Department', align: 'right',
                  render: (r) => rupees(r.entry_paise) },
                { key: 'platform_paise', label: 'Booking fee', align: 'right',
                  render: (r) => rupees(r.platform_paise) },
                { key: 'gst_paise', label: 'GST', align: 'right',
                  render: (r) => rupees(r.gst_paise) },
                { key: 'gateway_fee_paise', label: 'Gateway (est.)', align: 'right',
                  render: (r) => <span className="text-ink-500">{rupees(r.gateway_fee_paise)}</span> },
                { key: 'take_home_paise', label: 'Take-home (est.)', align: 'right',
                  render: (r) => <b>{rupees(r.take_home_paise)}</b> },
              ]}
              rows={d.days || []}
              empty="Nothing was collected in this period."
              footer={d.days?.length ? (
                <tr>
                  <td className="td">Total</td>
                  <td className="td text-right tnum">{num(t.tickets)}</td>
                  <td className="td text-right tnum">{rupees(t.gross_paise)}</td>
                  <td className="td text-right tnum">{rupees(t.entry_paise)}</td>
                  <td className="td text-right tnum">{rupees(t.platform_paise)}</td>
                  <td className="td text-right tnum">{rupees(t.gst_paise)}</td>
                  <td className="td text-right tnum">{rupees(t.gateway_fee_paise)}</td>
                  <td className="td text-right tnum">{rupees(t.take_home_paise)}</td>
                </tr>
              ) : null}
            />
          </Section>
        </>
      )}
    </>
  );
}

const Line = ({ k, v, bold, minus, muted }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold text-ink-900' : ''} ${muted ? 'text-ink-500' : ''}`}>
    <span>{k}</span>
    <span className="tnum">{minus ? '−' : ''}{rupees(v)}</span>
  </div>
);
