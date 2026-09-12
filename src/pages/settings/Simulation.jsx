import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { number } from '../../lib/format';
import { Banner, Field, Loading, Reason, reasonOk, useAction, when } from '../../components/ui.jsx';

/*
 * Demonstration mode — the panel, alive, for showing the product before it has
 * real traffic.
 *
 * It writes test bookings and gate activity every few seconds. It sends nothing
 * to anybody and looks no vehicle up. It stops by itself at the time shown, it
 * can be stopped here at once, and on a production server it cannot be switched
 * on at all.
 */
export default function Simulation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rate, setRate] = useState('steady');
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(null);
  const { busy, error: actionError, run } = useAction();

  const load = useCallback(() => api.simulation()
    .then((d) => { setData(d); setRate(d.rate); setError(null); })
    .catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  /* While it runs, the counters are the proof that it is running. */
  useEffect(() => {
    if (!data?.enabled) return undefined;
    const t = setInterval(() => api.simulation().then(setData).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, [data?.enabled]);

  if (error) return <Banner tone="wrong">{error}</Banner>;
  if (!data) return <Loading rows={3} />;

  const switchIt = async (enabled) => {
    const out = await run(() => api.setSimulation({ enabled, rate, hours: Number(hours), reason }));
    if (out) {
      setData(out);
      setReason('');
      setNotice(enabled
        ? `Running. It will stop by itself at ${new Date(out.until).toLocaleString('en-IN', { hour12: true, dateStyle: 'medium', timeStyle: 'short' })}.`
        : 'Stopped. Nothing more will be generated.');
    }
  };

  const remaining = data.until ? Math.max(0, Math.round((new Date(data.until) - Date.now()) / 60000)) : null;

  return (
    <div className="space-y-5">
      {notice && <Banner tone="good">{notice}</Banner>}

      {!data.available && (
        <Banner tone="wrong">
          This server does not allow demonstration mode — it is running as production. That is deliberate: generated traffic must never mix with real visitors.
        </Banner>
      )}

      <section className={`card border p-5 ${data.enabled ? 'border-watch-500/40 bg-watch-50' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`chip ${data.enabled ? 'bg-watch-500 text-white' : 'bg-shell text-muted'}`}>
                {data.enabled ? 'Running' : 'Stopped'}
              </span>
              <h2 className="text-base font-semibold text-ink">Demonstration mode</h2>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-body">
              Generates test bookings and gate activity every {data.tickSeconds} seconds, so the dashboard, live monitoring and
              the reports move while you are showing them. {data.note}
            </p>
            {data.enabled && (
              <p className="mt-1.5 text-2xs text-watch-700">
                Started {when(data.startedAt)} · stops by itself at {when(data.until)}
                {remaining !== null ? ` (${remaining} minutes left)` : ''}
              </p>
            )}
          </div>
          {data.enabled && (
            <button type="button" className="btn bg-wrong-500 text-white hover:bg-wrong-700" disabled={busy || !reasonOk(reason)}
              onClick={() => switchIt(false)}>
              {busy ? 'Stopping…' : 'Stop now'}
            </button>
          )}
        </div>

        {data.enabled && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Bookings made', data.sinceRestart.bookings],
              ['Vehicles entered', data.sinceRestart.entries],
              ['Refused at the gate', data.sinceRestart.refusals],
              ['Messages written', data.sinceRestart.messages],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-white px-3 py-2">
                <div className="text-2xs text-muted">{k}</div>
                <div className="tabular text-xl font-bold text-ink">{number(v)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-ink">{data.enabled ? 'Change how busy it is' : 'Start it'}</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <span className="label">How busy</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.rates.map((r) => (
                <label key={r.key} className={`cursor-pointer rounded-lg border px-3 py-2.5 ${rate === r.key ? 'border-brand bg-brand/5' : 'border-line'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="rate" className="h-4 w-4 accent-brand" checked={rate === r.key} onChange={() => setRate(r.key)} />
                    <span className="text-sm font-semibold text-ink">{r.label}</span>
                  </div>
                  <div className="mt-1 pl-6 text-2xs text-muted">{r.blurb}</div>
                  <div className="pl-6 text-2xs text-muted">{number(r.bookingsPerHour)} bookings · {number(r.entriesPerHour)} entries an hour</div>
                </label>
              ))}
            </div>
          </div>
          <Field label="Stop by itself after" hint="However it is switched off, it never runs longer than a day">
            <select className="input" value={hours} onChange={(e) => setHours(e.target.value)}>
              {[1, 2, 4, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-4 max-w-2xl">
          <Reason value={reason} onChange={setReason} placeholder="e.g. Demonstration for the department at 11am" />
          {actionError && <Banner tone="wrong" className="mt-3">{actionError}</Banner>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || !data.available || !reasonOk(reason)} onClick={() => switchIt(true)}>
              {busy ? 'Saving…' : data.enabled ? 'Apply and extend' : 'Start demonstration mode'}
            </button>
            {!data.enabled && <span className="self-center text-2xs text-muted">Nothing happens until you press this.</span>}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-ink">What it will and will not do</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-body">
          <li>✓ Books passes through the same code a visitor's booking uses, so capacity, pass numbers and money are the product's own arithmetic.</li>
          <li>✓ Marks every row it writes as test data, so it can all be removed again.</li>
          <li>✓ Uses reserved 000 numbers and vehicles already in the cache.</li>
          <li>✗ Never sends a WhatsApp message to anybody — conversation lines are written as history only.</li>
          <li>✗ Never looks a vehicle up, so no ULIP or gateway call can happen.</li>
          <li>✗ Never runs on a production server unless somebody sets ALLOW_SIMULATION deliberately.</li>
        </ul>
        <p className="mt-3 text-2xs text-muted">
          Today: {number(data.today.booked)} passes booked, {number(data.today.yetToArrive)} yet to arrive ·
          {' '}last hour: {number(data.lastHour.bookings)} bookings, {number(data.lastHour.checks)} gate checks
          {data.sinceRestart.lastTickAt ? ` · last tick ${when(data.sinceRestart.lastTickAt)}` : ''}
        </p>
        {data.sinceRestart.lastError && <Banner tone="wrong" className="mt-3">Last tick failed: {data.sinceRestart.lastError}</Banner>}
      </section>
    </div>
  );
}
