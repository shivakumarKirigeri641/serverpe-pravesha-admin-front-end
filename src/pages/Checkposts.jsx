import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import usePulse from '../lib/usePulse';
import Rolling from '../components/Rolling.jsx';
import { useSession, can } from '../lib/session';
import { clock, number, plate } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Checkposts — the physical entry points.
 *
 * Status is measured, not declared: a checkpost is "manned" because somebody is
 * signed in to the gate app, and the verification time is what the app recorded
 * for each vehicle. A gate that should be open with nobody signed in is shown
 * in red, because that is the one worth a phone call.
 */

const STATUS = {
  manned: ['Staff on duty', 'bg-good-50 text-good-700', 'border-good-500/30'],
  unmanned: ['Nobody signed in', 'bg-wrong-50 text-wrong-700', 'border-wrong-500/30'],
  off_hours: ['Outside opening hours', 'bg-shell text-muted', 'border-line'],
  closed: ['Not in use', 'bg-shell text-muted', 'border-line'],
};

const VERDICTS = {
  valid: ['Entered', 'text-good-700'],
  valid_override: ['Admitted anyway', 'text-watch-700'],
  already_used: ['Already used', 'text-wrong-700'],
  wrong_day: ['Wrong day', 'text-watch-700'],
  wrong_slot: ['Outside slot', 'text-watch-700'],
  unknown_ticket: ['No pass', 'text-wrong-700'],
  not_paid: ['Not paid', 'text-wrong-700'],
};

export default function Checkposts() {
  const { me } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [open, setOpen] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => api.checkposts().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  /* Redrawn when something happens at a gate or a booking lands, not every 30 seconds. */
  usePulse(load);

  const canManage = can(me, 'destinations.manage');

  return (
    <Shell title="Checkposts — Entry Point Management"
      subtitle={data ? `${number(data.checkposts.filter((c) => c.status === 'manned').length)} manned now · open ${data.hours.opens}–${data.hours.closes}` : 'Entry points, staff on duty and live activity'}
      actions={canManage && <button type="button" className="btn-primary !py-1.5 text-2xs" disabled={!data} onClick={() => setDialog({ kind: 'new' })}>Add checkpost</button>}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data && !error && <Loading rows={3} />}

      {data && (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.checkposts.map((c) => {
            const [label, chip, border] = STATUS[c.status];
            return (
              <article key={c.id} className={`card border p-5 ${border}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <button type="button" className="text-base font-semibold text-ink hover:underline" onClick={() => setOpen(c.id)}>{c.name}</button>
                    <p className="text-2xs text-muted">{c.place}{c.note ? ` · ${c.note}` : ''}</p>
                  </div>
                  <span className={`chip ${chip}`}>{label}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Entries today', number(c.entriesToday)],
                    ['Refused today', number(c.refusedToday)],
                    ['Last hour', number(c.lastHour)],
                    ['Average check', c.averageSeconds === null ? '—' : `${c.averageSeconds}s`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-line px-3 py-2">
                      <div className="text-2xs text-muted">{k}</div>
                      <div className="tabular text-lg font-bold text-ink"><Rolling text={String(v)} /></div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="text-2xs text-muted">
                    {number(c.staffAssigned)} staff posted · {c.onDutySince ? `on duty since ${clock(c.onDutySince)}` : 'nobody signed in'}
                    {c.lastActivity ? ` · last check ${when(c.lastActivity)}` : ''}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => setOpen(c.id)}>Activity</button>
                    {canManage && <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => setDialog({ kind: 'edit', checkpost: c })}>Edit</button>}
                    {canManage && (
                      <button type="button" className={`btn-quiet !px-3 !py-1.5 text-2xs ${c.active ? 'text-wrong-700' : 'text-good-700'}`}
                        onClick={() => setDialog({ kind: 'active', checkpost: c })}>{c.active ? 'Take out of use' : 'Bring into use'}</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && <CheckpostDrawer id={open} onClose={() => setOpen(null)} />}
      {/* The form needs the list of destinations, so it waits for the page to load. */}
      {dialog?.kind === 'new' && data && (
        <CheckpostForm places={data.places.filter((p) => p.active)} onClose={() => setDialog(null)}
          onSaved={(out) => { setDialog(null); setNotice(`${out.checkpost.name} added at ${out.checkpost.place}. Post staff to it under Settings → Checkpost staff.`); load(); }} />
      )}
      {dialog?.kind === 'edit' && (
        <CheckpostForm checkpost={dialog.checkpost} places={data.places} onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setNotice('Saved.'); load(); }} />
      )}
      {dialog?.kind === 'active' && (
        <ActiveDialog checkpost={dialog.checkpost} onClose={() => setDialog(null)}
          onDone={(out) => {
            setDialog(null);
            setNotice(dialog.checkpost.active
              ? `${dialog.checkpost.name} is out of use.${out.shiftsEnded ? ` ${number(out.shiftsEnded)} shift${out.shiftsEnded === 1 ? '' : 's'} ended.` : ''}`
              : `${dialog.checkpost.name} is back in use.`);
            load();
          }} />
      )}
    </Shell>
  );
}

function CheckpostDrawer({ id, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.checkpost(id).then(setData).catch((e) => setError(e.message)); }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div>
            <div className="text-base font-bold text-ink">{data?.checkpost.name || 'Checkpost'}</div>
            <div className="text-2xs text-muted">{data?.checkpost.place}{data ? ` · ${data.checkpost.statusLabel}` : ''}</div>
          </div>
          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={onClose}>Close</button>
        </div>

        {error && <div className="p-5"><Banner tone="wrong">{error}</Banner></div>}
        {!data && !error && <div className="p-5"><Loading rows={3} /></div>}

        {data && (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Checks today', number(data.checkpost.checksToday)],
                ['Entered', number(data.checkpost.entriesToday)],
                ['Refused', number(data.checkpost.refusedToday)],
                ['Average check', data.checkpost.averageSeconds === null ? '—' : `${data.checkpost.averageSeconds}s`],
              ].map(([k, v]) => (
                <div key={k} className="card p-3">
                  <div className="text-2xs text-muted">{k}</div>
                  <div className="tabular text-xl font-bold text-ink">{v}</div>
                </div>
              ))}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-ink">Today, hour by hour</h3>
              <div className="mt-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.hourly.filter((h) => h.hour >= 5 && h.hour <= 21)} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="#e4eaea" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 10 }} interval={1} />
                    <YAxis tickLine={false} axisLine={false} width={36} tick={{ fill: '#6b7f80', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', fontSize: 13 }} />
                    <Bar dataKey="entries" name="Entered" stackId="a" fill="#12a150" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="refused" name="Refused" stackId="a" fill="#d92d20" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card overflow-hidden">
                <div className="border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted">Staff posted here</div>
                {data.staff.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">Nobody posted yet.</p> : (
                  <ul className="divide-y divide-line">
                    {data.staff.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div>
                          <div className="text-sm text-ink">{s.name}</div>
                          <div className="text-2xs text-muted">{number(s.checksToday)} today{s.averageSeconds !== null ? ` · ${s.averageSeconds}s average` : ''}</div>
                        </div>
                        {s.onDutySince ? <span className="chip bg-good-50 text-good-700">On duty</span>
                          : s.active ? <span className="chip bg-shell text-muted">Off</span> : <span className="chip bg-shell text-muted">Disabled</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted">Recent shifts</div>
                {data.shifts.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No shifts yet.</p> : (
                  <ul className="divide-y divide-line">
                    {data.shifts.map((s, i) => (
                      <li key={i} className="px-4 py-2.5 text-sm">
                        <div className="text-ink">{s.staff}</div>
                        <div className="text-2xs text-muted">{when(s.startedAt)} → {s.endedAt ? clock(s.endedAt) : 'still on duty'}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted">Last 25 checks</div>
              {data.recent.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No checks recorded.</p> : (
                <table className="w-full">
                  <tbody className="divide-y divide-line">
                    {data.recent.map((r, i) => {
                      const [label, tone] = VERDICTS[r.verdict] || [r.verdict, 'text-muted'];
                      return (
                        <tr key={i}>
                          <td className="td whitespace-nowrap text-2xs text-muted">{when(r.at)}</td>
                          <td className="td font-mono text-sm text-ink">{r.regNo ? plate(r.regNo) : r.ticketNo || '—'}</td>
                          <td className={`td text-sm ${tone}`}>{label}</td>
                          <td className="td text-right text-2xs text-muted">{r.staff || '—'}{r.seconds !== null ? ` · ${r.seconds}s` : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function CheckpostForm({ checkpost, places, onClose, onSaved }) {
  const [f, setF] = useState({
    name: checkpost?.name || '', note: checkpost?.note || '', placeId: checkpost?.placeId || places[0]?.id || '',
    latitude: checkpost?.latitude ?? '', longitude: checkpost?.longitude ?? '',
  });
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    const body = { ...f, reason, latitude: f.latitude === '' ? null : Number(f.latitude), longitude: f.longitude === '' ? null : Number(f.longitude) };
    const out = await run(() => (checkpost ? api.updateCheckpost(checkpost.id, body) : api.addCheckpost(body)));
    if (out) onSaved(out);
  }

  return (
    <Modal title={checkpost ? `Edit ${checkpost.name}` : 'Add a checkpost'} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || f.name.trim().length < 3 || !f.placeId || !reasonOk(reason)}>
          {busy ? 'Saving…' : checkpost ? 'Save changes' : 'Add checkpost'}
        </button>
      </>}>
      <Field label="Name"><input className="input" value={f.name} onChange={set('name')} placeholder="Mullayanagiri Main Gate" /></Field>
      {!checkpost && (
        <Field label="Destination">
          <select className="input" value={f.placeId} onChange={set('placeId')}>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Note" hint="Where exactly it is, or anything staff should know"><input className="input" value={f.note} maxLength={500} onChange={set('note')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude"><input className="input tabular" value={f.latitude} onChange={set('latitude')} /></Field>
        <Field label="Longitude"><input className="input tabular" value={f.longitude} onChange={set('longitude')} /></Field>
      </div>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function ActiveDialog({ checkpost, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  const closing = checkpost.active;
  return (
    <Modal title={closing ? `Take ${checkpost.name} out of use` : `Bring ${checkpost.name} back into use`} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={closing ? 'btn bg-wrong-500 text-white hover:bg-wrong-700' : 'btn-primary'} disabled={busy || !reasonOk(reason)}
          onClick={async () => { const out = await run(() => api.setCheckpostActive(checkpost.id, !closing, reason)); if (out) onDone(out); }}>
          {busy ? 'Saving…' : closing ? 'Take out of use' : 'Bring into use'}
        </button>
      </>}>
      <p className="text-sm text-body">
        {closing
          ? 'Staff cannot sign in there, and any shift open at it ends now. A destination that is open for booking must keep at least one checkpost.'
          : 'Staff posted to it can sign in again.'}
      </p>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
