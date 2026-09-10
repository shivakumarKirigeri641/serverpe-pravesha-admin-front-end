/**
 * How full a day is, and how to close one.
 *
 * Closing a day is the most consequential thing anyone can do in this panel: it
 * stops sales and reaches into real people's bookings. So it is built as a
 * three-step commitment — pick, preview, confirm by typing the word — and the
 * preview comes from the server, not from anything this page guessed.
 *
 * Customers whose day is closed are offered a new date first and a refund
 * second. Postponing costs nothing and keeps the department's collection where
 * it is; a refund burns the gateway fee and, once the entry fee is settled,
 * means paying back money we no longer hold.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, longDate, today, when } from '../lib/format';
import { PageHead, Section, Table, Loading, Fill, Confirm, Field, Pill } from '../components/ui';

export default function Capacity({ admin }) {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState(null);
  const [closures, setClosures] = useState([]);
  const [slots, setSlots] = useState([]);

  /* the closure form */
  const [chosen, setChosen] = useState([]);      // slot ids; empty = whole day
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState('weather');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [occ, cl, cfg] = await Promise.all([
      api.get(`/occupancy?date=${date}`, { quiet: true }),
      api.get('/closures', { quiet: true }),
      api.get('/config', { quiet: true }),
    ]);
    setRows(occ.rows); setClosures(cl.rows); setSlots(cfg.slots);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  async function askPreview() {
    setBusy(true);
    try {
      const p = await api.post('/closures/preview',
        { travel_date: date, slot_ids: chosen }, { quiet: true });
      setPreview(p);
    } finally { setBusy(false); }
  }

  async function commit() {
    setBusy(true);
    try {
      await api.post('/closures', {
        travel_date: date, slot_ids: chosen, reason, kind });
      setPreview(null); setReason(''); setChosen([]);
      load();
    } finally { setBusy(false); }
  }

  async function lift(id) {
    await api.post(`/closures/${id}/lift`, {});
    load();
  }

  const closedToday = closures.filter(
    (c) => String(c.travel_date).slice(0, 10) === date && !c.lifted_at);

  return (
    <>
      <PageHead title="Capacity & closures"
                subtitle="How full each slot is, and how to stop selling a day." />

      <Section className="mb-5">
        <Field label="Date">
          <input type="date" className="input max-w-xs" value={date}
                 onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Section>

      {closedToday.length > 0 && (
        <div className="card p-4 mb-5 border-l-4 border-l-refused">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-refused text-sm">
                {longDate(date)} is closed
                {closedToday[0].slot_label ? ` for ${closedToday[0].slot_label}` : ''}
              </div>
              <p className="text-sm text-ink-600 mt-1">{closedToday[0].reason}</p>
              <p className="text-2xs text-ink-500 mt-2">
                {num(closedToday[0].tickets_affected)} ticket(s) affected ·
                {' '}{num(closedToday[0].tickets_postponed)} moved to another day ·
                {' '}{num(closedToday[0].tickets_refunded)} refunded
              </p>
            </div>
            {admin.can_write && (
              <button className="btn-ghost" onClick={() => lift(closedToday[0].id)}>
                Reopen booking
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <Section title={`Occupancy · ${shortDate(date)}`} className="lg:col-span-2">
          {!rows ? <Loading what="Loading capacity" /> : !rows.length ? (
            <p className="py-10 text-center text-sm text-ink-500">
              No bookings have been opened for this date yet. Slots are created the first time
              someone books.
            </p>
          ) : (
            <div className="space-y-4">
              {rows.map((c) => (
                <div key={`${c.slot_code}-${c.category_code}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-ink-900">{c.category_label}</span>
                      <span className="text-ink-500"> · {c.slot_label}</span>
                      {!c.is_open && <span className="ml-2"><Pill tone="refused">Closed</Pill></span>}
                    </div>
                    <div className="tnum text-2xs text-ink-500">
                      <b className="text-sm text-ink-900">{num(c.booked)}</b> booked
                      {c.held > 0 && <> · {num(c.held)} held</>}
                      {' '}· {num(c.available)} left of {num(c.capacity)}
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <Fill booked={c.booked} held={c.held} capacity={c.capacity} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Closing a day */}
        <Section title="Close this date"
                 note="Stops new bookings and offers everyone affected a new date or a refund.">
          {!admin.can_write ? (
            <p className="py-8 text-sm text-ink-500">
              Your account can view this page but not change it.
            </p>
          ) : (
            <div className="space-y-4">
              <Field label="Which part of the day">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={chosen.length === 0}
                           onChange={() => setChosen([])} />
                    The whole day
                  </label>
                  {slots.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={chosen.includes(s.id)}
                             onChange={(e) => setChosen(
                               e.target.checked ? [...chosen, s.id] : chosen.filter((x) => x !== s.id))} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Why">
                <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="weather">Heavy rain</option>
                  <option value="landslide">Landslide / road blocked</option>
                  <option value="vip">VIP visit</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Message to visitors"
                     hint="This is shown to them word for word, so write it for them.">
                <textarea className="input" rows={3} value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Heavy rain and landslide risk on the ghat road." />
              </Field>

              <button className="btn-danger w-full" disabled={!reason.trim() || busy}
                      onClick={askPreview}>
                {busy ? 'Checking…' : 'See what this would do'}
              </button>
            </div>
          )}
        </Section>
      </div>

      <Section title="Closure history" className="mt-5">
        <Table
          columns={[
            { key: 'travel_date', label: 'Date', render: (r) => longDate(r.travel_date) },
            { key: 'slot_label', label: 'Slots', render: (r) => r.slot_label || 'Whole day' },
            { key: 'reason', label: 'Reason', className: 'whitespace-normal max-w-xs' },
            { key: 'tickets_affected', label: 'Affected', align: 'right',
              render: (r) => num(r.tickets_affected) },
            { key: 'tickets_postponed', label: 'Moved', align: 'right',
              render: (r) => num(r.tickets_postponed) },
            { key: 'tickets_refunded', label: 'Refunded', align: 'right',
              render: (r) => num(r.tickets_refunded) },
            { key: 'created_by_name', label: 'By',
              render: (r) => <span className="text-ink-500">{r.created_by_name || '—'}</span> },
            { key: 'status', label: 'Status',
              render: (r) => r.lifted_at
                ? <Pill tone="muted">Reopened</Pill>
                : <Pill tone="refused">Closed</Pill> },
          ]}
          rows={closures}
          empty="No day has ever been closed."
        />
      </Section>

      <Confirm
        open={!!preview}
        danger
        title={`Close ${longDate(date)}?`}
        confirmWord="CLOSE"
        confirmLabel="Close the date"
        busy={busy}
        onCancel={() => setPreview(null)}
        onConfirm={commit}
        body={preview && (
          <>
            <p>
              <b>{num(preview.tickets_affected)} ticket(s)</b> worth{' '}
              <b>{rupees(preview.amount_paise)}</b> are booked for this date.
            </p>
            {preview.already_used > 0 && (
              <p>
                {num(preview.already_used)} of them have already been through the gate and will not
                be touched.
              </p>
            )}
            <p>
              {num(preview.will_be_offered)} visitor(s) will be told the day is closed and offered
              another date, or a full refund if they prefer.
            </p>
            <p className="text-ink-500">
              Booking stops immediately. This cannot be undone — reopening later allows new bookings
              but does not reverse a refund.
            </p>
          </>
        )}
      />
    </>
  );
}
