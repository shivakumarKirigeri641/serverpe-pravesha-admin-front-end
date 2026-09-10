/**
 * What the checkposts saw, and who was holding the phone.
 *
 * The default view is EVERY scan, but the "refused only" filter is the one that
 * matters in a review meeting: it is the list of attempts the old paper system
 * would have let through. Each row names the staff member, the checkpost and
 * whether the phone was offline at the time, because an accusation is only
 * useful if it can be traced to a person and a moment.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { when, plate, verdict, toneClass, daysAgo, today, num } from '../lib/format';
import { PageHead, Section, Table, Loading, Stat } from '../components/ui';

export default function GateLog() {
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [refused, setRefused] = useState(false);
  const [data, setData] = useState(null);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    const qs = `from=${from}&to=${to}${refused ? '&refused=true' : ''}`;
    api.get(`/scans?${qs}`, { quiet: true }).then(setData);
    api.get(`/staff-activity?from=${from}&to=${to}`, { quiet: true })
      .then((r) => setStaff(r.rows));
  }, [from, to, refused]);

  const tally = (data?.rows || []).reduce((a, r) => {
    a[r.verdict] = (a[r.verdict] || 0) + 1; return a;
  }, {});
  const allowed = tally.valid || 0;
  const turnedAway = (data?.rows || []).length - allowed;

  return (
    <>
      <PageHead title="Gate log" subtitle="Every scan, including the refusals.">
        <button className="btn-ghost"
                onClick={() => api.download(`/export/scans?from=${from}&to=${to}`,
                  `gate-log-${from}-to-${to}.csv`)}>
          Download CSV
        </button>
      </PageHead>

      <Section className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <div className="label">From</div>
            <input type="date" className="input mt-1" value={from}
                   onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <div className="label">To</div>
            <input type="date" className="input mt-1" value={to}
                   onChange={(e) => setTo(e.target.value)} />
          </label>
          <button
            className={refused ? 'btn-danger' : 'btn-ghost'}
            onClick={() => setRefused((v) => !v)}
          >
            {refused ? 'Showing refusals only' : 'Show refusals only'}
          </button>
        </div>
      </Section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Scans in this period" value={num(data?.total)} />
        <Stat label="Allowed through" value={num(allowed)} tone="allowed" />
        <Stat label="Turned away" value={num(turnedAway)} tone={turnedAway ? 'refused' : undefined} />
        <Stat label="Altered or copied"
              value={num((tally.invalid_signature || 0) + (tally.already_used || 0))}
              tone={(tally.invalid_signature || tally.already_used) ? 'refused' : undefined}
              hint="tickets that would have passed on paper" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Section title="Scans" className="lg:col-span-2">
          {!data ? <Loading what="Loading the gate log" /> : (
            <Table
              columns={[
                { key: 'scanned_at', label: 'When',
                  render: (r) => (
                    <div>
                      <div>{when(r.scanned_at)}</div>
                      {r.was_offline && (
                        <div className="text-2xs text-pending">offline · synced {when(r.synced_at)}</div>
                      )}
                    </div>
                  ) },
                { key: 'verdict', label: 'Verdict',
                  render: (r) => {
                    const v = verdict(r.verdict);
                    return <span className={`pill ${toneClass(v.tone)}`}>{v.label}</span>;
                  } },
                { key: 'reg_no', label: 'Vehicle',
                  render: (r) => <span className="font-medium">{plate(r.reg_no) || '—'}</span> },
                { key: 'ticket_no', label: 'Ticket',
                  render: (r) => <span className="font-mono text-xs">{r.ticket_no || '—'}</span> },
                { key: 'staff_name', label: 'Scanned by',
                  render: (r) => (
                    <div>
                      <div>{r.staff_name || '—'}</div>
                      <div className="text-2xs text-ink-500">{r.checkpost_name}</div>
                    </div>
                  ) },
              ]}
              rows={data.rows}
              empty={refused ? 'No refusals in this period — every ticket presented was genuine.'
                             : 'No scans in this period.'}
            />
          )}
        </Section>

        <Section title="Staff on the gate"
                 note="Who was scanning, and what they saw.">
          {!staff.length ? (
            <p className="py-8 text-center text-sm text-ink-500">Nobody scanned in this period.</p>
          ) : (
            <ul className="divide-y divide-ink-300/40">
              {staff.map((s) => (
                <li key={s.id} className="py-3 first:pt-0">
                  <div className="flex items-baseline justify-between">
                    <div className="font-medium text-sm text-ink-900">{s.name}</div>
                    <div className="tnum text-sm font-semibold">{num(s.scans)}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-ink-500">
                    <span className="text-allowed">{num(s.allowed)} allowed</span>
                    {s.refused > 0 && <span className="text-refused">{num(s.refused)} refused</span>}
                    {s.offline > 0 && <span className="text-pending">{num(s.offline)} offline</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
