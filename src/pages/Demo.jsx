import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Demo & test data — TEMPORARY.
 *
 * Everything on this screen exists to show the product before it has real
 * traffic: a switch that makes activity happen, and buttons that fill or empty
 * the demonstration database. It is its own permission so it can be given to
 * whoever is demonstrating and taken away again, and the whole screen is meant
 * to be deleted once the product is approved.
 *
 * Nothing here can reach a visitor: no message is sent, no vehicle is looked up,
 * and only rows marked as test data are ever written or removed.
 */

export default function Demo() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => api.demo().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  /* While something is running — the simulation or a job — keep it fresh. */
  const busyNow = data?.simulation?.enabled || data?.jobs?.running;
  useEffect(() => {
    if (!busyNow) return undefined;
    const t = setInterval(() => api.demo().then(setData).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [busyNow]);

  if (error) return <Shell title="Demo & test data"><Banner tone="wrong">{error}</Banner></Shell>;
  if (!data) return <Shell title="Demo & test data"><Loading rows={4} /></Shell>;

  const sim = data.simulation;

  return (
    <Shell title="Demo & test data"
      subtitle="Temporary tools for showing the product — remove before launch"
      actions={sim.enabled
        ? <span className="chip bg-watch-500 text-white">Demonstration mode running</span>
        : <span className="chip bg-shell text-muted">Demonstration mode off</span>}>

      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data.available && (
        <Banner tone="wrong" className="mb-4">
          This is a production server, so these tools are switched off. That is deliberate — generated traffic must never mix with real visitors.
        </Banner>
      )}

      <div className="space-y-7">
        <Simulation data={data} onChanged={(d, msg) => { setData((x) => ({ ...x, simulation: d.simulation })); setNotice(msg); load(); }} />
        <TestData data={data} onRan={(msg) => { setNotice(msg); load(); }} onDialog={setDialog} dialog={dialog} />
        <Removal />
      </div>
    </Shell>
  );
}

/* ─────────────────────────────────────────────── demonstration mode ── */

function Simulation({ data, onChanged }) {
  const sim = data.simulation;
  const [rate, setRate] = useState(sim.rate);
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();

  const switchIt = async (enabled) => {
    const out = await run(() => api.setDemoSimulation({ enabled, rate, hours: hours === 'never' ? 'never' : Number(hours), reason }));
    if (out) {
      setReason('');
      onChanged(out, enabled
        ? (out.simulation.until
          ? `Running. It will stop by itself at ${new Date(out.simulation.until).toLocaleString('en-IN', { hour12: true, dateStyle: 'medium', timeStyle: 'short' })}.`
          : 'Running. It will keep going until you stop it.')
        : 'Stopped. Nothing more will be generated.');
    }
  };

  const remaining = sim.until ? Math.max(0, Math.round((new Date(sim.until) - Date.now()) / 60000)) : null;
  const plan = sim.sinceRestart?.plan;

  return (
    <section>
      <h2 className="mb-2.5 text-[15px] font-semibold text-ink">Demonstration mode</h2>

      <div className={`card border p-5 ${sim.enabled ? 'border-watch-500/40 bg-watch-50' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm text-body">
              Generates bookings and gate activity every {sim.tickSeconds} seconds, so the dashboard, live monitoring and the
              reports move while you are showing them. {sim.note}
            </p>
            {sim.enabled && (
              <p className="mt-1.5 text-2xs text-watch-700">
                Started {when(sim.startedAt)} ·{' '}
                {sim.until
                  ? `stops by itself at ${when(sim.until)}${remaining !== null ? ` (${remaining} minutes left)` : ''}`
                  : 'no automatic stop — it runs until you stop it'}
              </p>
            )}
          </div>
          {sim.enabled && (
            <button type="button" className="btn bg-wrong-500 text-white hover:bg-wrong-700" disabled={busy || !reasonOk(reason)} onClick={() => switchIt(false)}>
              {busy ? 'Stopping…' : 'Stop now'}
            </button>
          )}
        </div>

        {sim.enabled && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Bookings made', sim.sinceRestart.bookings], ['Vehicles entered', sim.sinceRestart.entries],
                ['Refused at the gate', sim.sinceRestart.refusals], ['Messages written', sim.sinceRestart.messages]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line bg-white px-3 py-2">
                    <div className="text-2xs text-muted">{k}</div>
                    <div className="tabular text-xl font-bold text-ink">{number(v)}</div>
                  </div>
              ))}
            </div>
            {plan?.mode === 'automatic' && (
              <p className="mt-3 text-2xs text-watch-700">
                Today should reach {plan.targetOccupancy}% of capacity ({number(plan.target)} passes); it is at {plan.occupancy}%
                ({number(plan.booked)} booked, {number(plan.yetToArrive)} still to arrive). Working at about {number(plan.bookingsPerHour)} bookings
                and {number(plan.entriesPerHour)} arrivals an hour to get there.
              </p>
            )}
          </>
        )}
      </div>

      <div className="card mt-4 p-5">
        <h3 className="text-sm font-semibold text-ink">{sim.enabled ? 'Change how it runs' : 'Start it'}</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <span className="label">How busy</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {sim.rates.map((r) => (
                <label key={r.key} className={`cursor-pointer rounded-lg border px-3 py-2.5 ${rate === r.key ? 'border-brand bg-brand/5' : 'border-line'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="rate" className="h-4 w-4 accent-brand" checked={rate === r.key} onChange={() => setRate(r.key)} />
                    <span className="text-sm font-semibold text-ink">{r.label}</span>
                    {r.automatic && <span className="chip bg-good-50 text-good-700">Recommended</span>}
                  </div>
                  <div className="mt-1 pl-6 text-2xs text-muted">{r.blurb}</div>
                  {!r.automatic && (
                    <div className="pl-6 text-2xs text-muted">{number(r.bookingsPerHour)} bookings · {number(r.entriesPerHour)} entries an hour</div>
                  )}
                </label>
              ))}
            </div>
            {rate === 'automatic' && (
              <div className="mt-3 overflow-hidden rounded-lg border border-line">
                <div className="border-b border-line bg-shell px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted">
                  The pattern it works to, per slot
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-4">
                  {sim.occupancyPattern.map((d) => (
                    <li key={d.day} className="flex items-baseline justify-between gap-2 text-2xs">
                      <span className="text-muted">{d.day.slice(0, 3)}</span>
                      <span className="tabular font-semibold text-ink">{d.from}–{d.to}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            <Field label="Stop by itself after" hint={hours === 'never'
              ? 'It will keep running until you stop it — every screen will say so while it does.'
              : 'A safety net: it stops on its own even if the tab is closed.'}>
              <select className="input" value={hours} onChange={(e) => setHours(e.target.value)}>
                {[1, 2, 4, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>)}
                <option value="never">Never — run until I stop it</option>
              </select>
            </Field>
            {hours === 'never' && (
              <Banner tone="watch" className="mt-2">
                Nothing will switch it off for you. Stop it here before the service goes live.
              </Banner>
            )}
          </div>
        </div>

        <div className="mt-4 max-w-2xl">
          <Reason value={reason} onChange={setReason} placeholder="e.g. Demonstration for the department at 11am" />
          {error && <Banner tone="wrong" className="mt-3">{error}</Banner>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={busy || !data.available || !reasonOk(reason)} onClick={() => switchIt(true)}>
              {busy ? 'Saving…' : sim.enabled ? 'Apply and extend' : 'Start demonstration mode'}
            </button>
            {!sim.enabled && <span className="text-2xs text-muted">Nothing happens until you press this.</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────── test data ── */

function TestData({ data, onRan, dialog, onDialog }) {
  const d = data.data;
  const job = data.jobs.running;
  const recent = data.jobs.recent[0];

  const rows = [
    ['Passes', d.tickets], ['Payments', d.payments], ['Invoices', d.invoices],
    ['Gate checks', d.scans], ['Visitors', d.visitors], ['Vehicles', d.vehicles], ['WhatsApp messages', d.messages],
  ];

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Test data</h2>
          <p className="text-2xs text-muted">
            What is in the database{d.range.from ? `, covering ${d.range.from} to ${d.range.to}` : ''} — test rows against real ones
          </p>
        </div>
      </div>

      <div className="card mb-4 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-line bg-shell">
            <tr><th className="th">Rows</th><th className="th text-right">Test</th><th className="th text-right">Real</th><th className="th text-right">In all</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([label, v]) => (
              <tr key={label}>
                <td className="td text-ink">{label}</td>
                <td className="td tabular text-right">{number(v.test)}</td>
                <td className="td tabular text-right font-semibold text-ink">{number(v.real)}</td>
                <td className="td tabular text-right text-muted">{number(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.jobs.actions.map((a) => (
          <div key={a.key} className={`card p-4 ${a.destructive ? 'border-wrong-500/30' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">{a.label}</h3>
                <p className="mt-1 text-2xs text-muted">{a.blurb}</p>
              </div>
            </div>
            <div className="mt-3">
              <button type="button"
                className={a.destructive ? 'btn bg-wrong-500 text-white hover:bg-wrong-700 !py-1.5 text-2xs' : 'btn-quiet !py-1.5 text-2xs'}
                disabled={Boolean(job) || !data.available || (a.destructive && !data.canReset)}
                title={a.destructive && !data.canReset ? 'Only a super administrator may remove test data' : undefined}
                onClick={() => onDialog(a)}>
                {job ? 'Something is running…' : a.destructive ? 'Remove test data' : 'Run'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {(job || recent) && (
        <div className="card mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div>
              <h3 className="text-sm font-semibold text-ink">{(job || recent).label}</h3>
              <p className="text-2xs text-muted">
                {job ? `running · started ${when(job.startedAt)}` : `${recent.ok ? 'finished' : 'failed'} · ${when(recent.finishedAt)}`}
                {' '}· asked for by {(job || recent).by}
              </p>
            </div>
            {job && <span className="chip bg-watch-50 text-watch-700">Running</span>}
          </div>
          <pre className="max-h-64 overflow-auto bg-ink/95 px-4 py-3 font-mono text-2xs leading-relaxed text-white">
            {((job || recent).log || []).join('\n') || 'Starting…'}
          </pre>
        </div>
      )}

      {dialog && (
        <RunDialog action={dialog} onClose={() => onDialog(null)}
          onDone={(msg) => { onDialog(null); onRan(msg); }} />
      )}
    </section>
  );
}

function RunDialog({ action, onClose, onDone }) {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [options, setOptions] = useState({ from: `${today.slice(0, 4)}-08-01`, to: today, holidays: '', count: '200', keepPrices: false });
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setOptions((o) => ({ ...o, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const ready = reasonOk(reason) && (!action.destructive || confirm.trim().toUpperCase() === 'REMOVE TEST DATA');

  return (
    <Modal title={action.label} subtitle={action.destructive ? 'This cannot be undone' : undefined} onClose={onClose} busy={busy} wide
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={action.destructive ? 'btn bg-wrong-500 text-white hover:bg-wrong-700' : 'btn-primary'}
          disabled={busy || !ready}
          onClick={async () => {
            const out = await run(() => api.runDemoJob({ action: action.key, reason, confirm, options }));
            if (out) onDone(`${action.label} — started. The output appears below as it runs.`);
          }}>
          {busy ? 'Starting…' : action.destructive ? 'Remove test data' : 'Run it'}
        </button>
      </>}>
      <p className="text-sm text-body">{action.blurb}</p>

      {action.key === 'seed' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From"><input type="date" className="input" value={options.from} onChange={set('from')} /></Field>
          <Field label="To" hint="Today by default"><input type="date" className="input" max={today} value={options.to} onChange={set('to')} /></Field>
          <Field label="Holidays" className="sm:col-span-2" hint="Dates that should reach 98–100%, separated by commas">
            <input className="input font-mono" placeholder="2026-08-15,2026-08-28" value={options.holidays} onChange={set('holidays')} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={options.keepPrices} onChange={set('keepPrices')} />
            Leave prices and capacity as they are
          </label>
        </div>
      )}

      {action.key === 'conversations' && (
        <Field label="How many threads"><input type="number" min="10" max="2000" className="input tabular" value={options.count} onChange={set('count')} /></Field>
      )}

      {action.destructive && (
        <>
          <Banner tone="wrong">
            Every test pass, payment, invoice, gate check, vehicle, visitor and conversation is deleted, and the slot counters are reset.
            Real rows — and the one real conversation — are left alone.
          </Banner>
          <Field label="Type REMOVE TEST DATA to confirm">
            <input className="input font-mono uppercase" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </>
      )}

      <Reason value={reason} onChange={setReason} placeholder="e.g. Resetting before the demonstration on Monday" />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

const Removal = () => (
  <section className="card p-5">
    <h2 className="text-sm font-semibold text-ink">When this is approved, delete it</h2>
    <p className="mt-1 text-sm text-body">
      Everything on this screen is temporary. Nothing in the product imports it, so it can be removed in one commit:
    </p>
    <ul className="mt-2 space-y-1 font-mono text-2xs text-muted">
      <li>src/simulation/ · src/demo/ · src/routes/adminDemoApi.js</li>
      <li>scripts/temp-seed-occupancy.js · scripts/seed-test-*.js</li>
      <li>the demo.simulate and demo.reset capabilities in src/gatepass/permissions.js</li>
      <li>this page, and its entry in the panel's navigation</li>
    </ul>
    <p className="mt-2 text-2xs text-muted">
      The is_test columns are worth keeping: they are what lets test rows be told apart from real ones for good.
    </p>
  </section>
);
