/**
 * Daily, weekly and monthly reports.
 *
 * The panel shows the summary FIRST and offers the download second. An officer
 * usually wants the number, not the file — and someone who downloads a report
 * without having seen its headline figures has no idea whether it is the one
 * they meant to pull.
 *
 * Two formats, because two different people ask for them: a PDF for the folder
 * and the meeting, a CSV for whoever is going to re-total it in Excel. Both
 * carry the same content down to the last scan.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, longDate, today, verdict, toneClass } from '../lib/format';
import { PageHead, Section, Stat, Table, Loading, Field } from '../components/ui';

const PERIODS = [
  { id: 'daily', label: 'Daily', hint: 'One day, pin to pin' },
  { id: 'weekly', label: 'Weekly', hint: 'Monday to Sunday' },
  { id: 'monthly', label: 'Monthly', hint: 'Calendar month' },
];

export default function Reports() {
  const [period, setPeriod] = useState('daily');
  const [date, setDate] = useState(today());
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setD(null);
    api.get(`/report/${period}/summary?date=${date}`, { quiet: true }).then(setD);
  }, [period, date]);

  async function download(format) {
    setBusy(true);
    try {
      await api.download(`/report/${period}?date=${date}&format=${format}`,
        `${period}-report-${d?.from || date}.${format}`);
    } finally { setBusy(false); }
  }

  const t = d?.totals || {};
  const g = d?.gate || {};

  return (
    <>
      <PageHead
        title="Reports"
        subtitle={d ? `${longDate(d.from)}${d.from !== d.to ? ` to ${longDate(d.to)}` : ''}` : ' '}
      >
        <button className="btn-ghost" disabled={!d || busy} onClick={() => download('csv')}>
          Download CSV
        </button>
        <button className="btn-primary" disabled={!d || busy} onClick={() => download('pdf')}>
          {busy ? 'Preparing…' : 'Download PDF'}
        </button>
      </PageHead>

      {/* Which report */}
      <Section className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="label mb-1.5">Period</div>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-md border px-3.5 py-2 text-left transition ${
                    period === p.id
                      ? 'border-forest-700 bg-forest-50'
                      : 'border-ink-300 bg-paper-raised hover:bg-paper-sunken'
                  }`}
                >
                  <div className={`text-sm font-semibold ${
                    period === p.id ? 'text-forest-900' : 'text-ink-800'}`}>{p.label}</div>
                  <div className="text-2xs text-ink-500">{p.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <Field label={period === 'daily' ? 'Date'
            : period === 'weekly' ? 'Any day in the week' : 'Any day in the month'}>
            <input type="date" className="input" value={date}
                   onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Section>

      {!d ? <Loading what="Working out the figures" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Tickets sold" value={num(t.tickets || 0)}
                  hint={`${num(d.counts.refunds)} refunded`} />
            <Stat label="Total collected" value={rupees(t.gross_paise)}
                  hint={`Department ${rupees(t.entry_paise)}`} />
            <Stat label="Entered the gate" value={num(g.allowed)} tone="allowed"
                  hint={`${num(g.scanned)} scans in total`} />
            <Stat label="Refused at the gate" value={num(g.refused)}
                  tone={g.refused ? 'refused' : undefined}
                  hint={g.fraudulent
                    ? `${num(g.fraudulent)} altered or copied`
                    : 'nothing turned away'} />
          </div>

          {g.fraudulent > 0 && (
            <div className="card border-l-4 border-l-refused p-4 mb-5">
              <div className="text-sm font-semibold text-refused">
                {num(g.fraudulent)} altered or duplicated ticket(s) stopped in this period
              </div>
              <p className="text-sm text-ink-600 mt-1">
                Under a printed-ticket system every one of these would have been admitted, and
                nothing would have recorded that it happened.
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            <Section title="What the report contains" className="lg:col-span-1"
                     note="Both formats carry all of it.">
              <ul className="divide-y divide-ink-300/40 text-sm">
                {[
                  ['Every ticket', d.counts.tickets],
                  ['Every scan', d.counts.scans],
                  ['Refunds', d.counts.refunds],
                  ['Closures', d.counts.closures],
                  ['Visitor messages', d.counts.messages],
                  ['Staff on the gate', d.staff?.length || 0],
                ].map(([label, n]) => (
                  <li key={label} className="flex justify-between py-2">
                    <span className="text-ink-700">{label}</span>
                    <span className="tnum font-semibold">{num(n)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-2xs text-ink-500 leading-relaxed">
                Plus the money split three ways, day by day, and the gate's verdicts with the
                staff member who recorded each one.
              </p>
            </Section>

            <Section title="Money" className="lg:col-span-2">
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
                  { key: 'take_home_paise', label: 'Take-home', align: 'right',
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
                    <td className="td text-right tnum">{rupees(t.take_home_paise)}</td>
                  </tr>
                ) : null}
              />
            </Section>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Section title="At the gate">
              <ul className="space-y-2">
                {Object.entries(g)
                  .filter(([k, v]) => v && !['scanned', 'allowed', 'refused', 'fraudulent'].includes(k))
                  .map(([k, v]) => {
                    const vd = verdict(k);
                    return (
                      <li key={k} className="flex items-center justify-between gap-3">
                        <span className={`pill ${toneClass(vd.tone)}`}>{vd.label}</span>
                        <span className="tnum text-sm font-semibold">{num(v)}</span>
                      </li>
                    );
                  })}
                {!g.scanned && (
                  <li className="py-6 text-center text-sm text-ink-500">No scans in this period.</li>
                )}
              </ul>
            </Section>

            <Section title="By vehicle type">
              <Table
                columns={[
                  { key: 'label', label: 'Type' },
                  { key: 'tickets', label: 'Tickets', align: 'right', render: (r) => num(r.tickets) },
                  { key: 'gross_paise', label: 'Collected', align: 'right',
                    render: (r) => rupees(r.gross_paise) },
                ]}
                rows={d.categories || []}
                empty="No tickets in this period."
              />
            </Section>

            <Section title="Staff on the gate">
              <Table
                columns={[
                  { key: 'name', label: 'Staff' },
                  { key: 'scans', label: 'Scans', align: 'right', render: (r) => num(r.scans) },
                  { key: 'refused', label: 'Refused', align: 'right',
                    render: (r) => r.refused
                      ? <span className="text-refused font-semibold">{num(r.refused)}</span>
                      : <span className="text-ink-400">0</span> },
                ]}
                rows={d.staff || []}
                empty="Nobody scanned in this period."
              />
            </Section>
          </div>
        </>
      )}
    </>
  );
}
