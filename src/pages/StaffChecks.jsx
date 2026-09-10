/**
 * How each staff member is actually performing at the gate.
 *
 * Two numbers matter here and they pull in opposite directions.
 *
 *   SCANS PER HOUR says whether a queue is forming. It falling is an
 *   operational problem, not a disciplinary one.
 *
 *   REFUSAL RATE says whether checking is happening at all. A staff member who
 *   refuses nothing over a busy weekend is either extraordinarily lucky or
 *   waving people through, and the difference matters.
 *
 * Neither is shown as a score. They are shown next to each other, because
 * either one alone invites the wrong conclusion.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { num, when, timeOnly, shortDate, daysAgo, today } from '../lib/format';
import { PageHead, Section, Table, Stat, Pill, Loading, Field } from '../components/ui';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';

const GRID = '#e6eae8';
const AXIS = { fontSize: 11, fill: '#6b7975' };
const TIP = { fontSize: 12, borderRadius: 8, border: '1px solid #c2ccc8' };

export default function StaffChecks() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api.get(`/staff-performance?from=${from}&to=${to}`, { quiet: true }).then(setD);
  }, [from, to]);

  const active = (d?.rows || []).filter((r) => r.scans > 0);
  const totals = active.reduce((a, r) => ({
    scans: a.scans + r.scans, refused: a.refused + r.refused,
    caught: a.caught + r.caught, hours: a.hours + (r.hours_on_duty || 0),
  }), { scans: 0, refused: 0, caught: 0, hours: 0 });

  return (
    <>
      <PageHead title="Staff checks"
                subtitle={`${shortDate(from)} to ${shortDate(to)}`}>
        {[['7 days', 7], ['30 days', 30], ['90 days', 90]].map(([l, n]) => (
          <button key={n} className="btn-ghost !py-1.5"
                  onClick={() => { setFrom(daysAgo(n)); setTo(today()); }}>{l}</button>
        ))}
      </PageHead>

      <Section className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <input type="date" className="input" value={from}
                   onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={to}
                   onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Section>

      {!d ? <Loading what="Loading gate performance" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Scans in this period" value={num(totals.scans)}
                  hint={`across ${num(active.length)} staff`} />
            <Stat label="Hours on duty" value={num(Math.round(totals.hours))}
                  hint={totals.hours > 0
                    ? `${Math.round((totals.scans / totals.hours) * 10) / 10} scans an hour`
                    : '—'} />
            <Stat label="Refused" value={num(totals.refused)}
                  tone={totals.refused ? 'refused' : undefined} />
            <Stat label="Altered or duplicated caught" value={num(totals.caught)}
                  tone={totals.caught ? 'refused' : undefined}
                  hint="would have passed on paper" />
          </div>

          <Section title="Scans by staff member"
                   note="Allowed against refused. A tall red portion is not necessarily bad — it may be a busy gate doing its job."
                   className="mb-5">
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={active.map((r) => ({
                  name: r.name.split(' ')[0], Allowed: r.allowed, Refused: r.refused,
                }))}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={TIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Allowed" stackId="a" fill="#0f766e" />
                  <Bar dataKey="Refused" stackId="a" fill="#b91c1c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {!active.length && (
              <p className="text-center text-sm text-ink-500 -mt-40 pb-40">
                Nobody scanned in this period.
              </p>
            )}
          </Section>

          <Section title="Per staff member" className="mb-5">
            <Table
              columns={[
                { key: 'name', label: 'Staff',
                  render: (r) => (
                    <div>
                      <div className="font-medium">{r.name}</div>
                      {!r.is_active && <Pill tone="muted">Inactive</Pill>}
                    </div>
                  ) },
                { key: 'scans', label: 'Scans', align: 'right', render: (r) => num(r.scans) },
                { key: 'allowed', label: 'Allowed', align: 'right',
                  render: (r) => <span className="text-allowed">{num(r.allowed)}</span> },
                { key: 'refused', label: 'Refused', align: 'right',
                  render: (r) => r.refused
                    ? <span className="text-refused font-semibold">{num(r.refused)}</span>
                    : <span className="text-ink-400">0</span> },
                { key: 'refusal_rate', label: 'Refusal rate', align: 'right',
                  render: (r) => `${r.refusal_rate}%` },
                { key: 'caught', label: 'Fakes caught', align: 'right',
                  render: (r) => r.caught
                    ? <b className="text-refused">{num(r.caught)}</b> : '0' },
                { key: 'hours_on_duty', label: 'Hours', align: 'right',
                  render: (r) => r.hours_on_duty || 0 },
                { key: 'per_hour', label: 'Per hour', align: 'right',
                  render: (r) => <b>{r.per_hour}</b> },
                { key: 'shifts', label: 'Shifts', align: 'right', render: (r) => num(r.shifts) },
                { key: 'offline', label: 'Offline scans', align: 'right',
                  render: (r) => r.offline
                    ? <span className="text-pending">{num(r.offline)}</span> : '0' },
                { key: 'last_scan', label: 'Last scan',
                  render: (r) => r.last_scan
                    ? <span className="text-ink-500 text-xs">{when(r.last_scan)}</span>
                    : <span className="text-ink-400">never</span> },
              ]}
              rows={d.rows}
              empty="No staff have been added yet."
            />
          </Section>

          <Section title="Shifts"
                   note="Every sign-in, how long it ran, and how it ended.">
            <Table
              columns={[
                { key: 'staff_name', label: 'Staff' },
                { key: 'checkpost_name', label: 'Checkpost' },
                { key: 'device_label', label: 'Phone',
                  render: (r) => <span className="text-ink-500">{r.device_label || '—'}</span> },
                { key: 'started_at', label: 'Started', render: (r) => when(r.started_at) },
                { key: 'ended_at', label: 'Ended',
                  render: (r) => r.ended_at
                    ? timeOnly(r.ended_at)
                    : <Pill tone="allowed">On duty</Pill> },
                { key: 'hours', label: 'Hours', align: 'right', render: (r) => r.hours },
                { key: 'scans', label: 'Scans', align: 'right', render: (r) => num(r.scans) },
                { key: 'refused', label: 'Refused', align: 'right',
                  render: (r) => r.refused
                    ? <span className="text-refused">{num(r.refused)}</span> : '0' },
                { key: 'ended_reason', label: 'Ended by',
                  render: (r) => r.ended_reason
                    ? <span className="text-2xs text-ink-500">
                        {r.ended_reason.replace(/_/g, ' ')}</span>
                    : '' },
              ]}
              rows={d.shifts}
              empty="No shifts recorded in this period."
            />
          </Section>
        </>
      )}
    </>
  );
}
