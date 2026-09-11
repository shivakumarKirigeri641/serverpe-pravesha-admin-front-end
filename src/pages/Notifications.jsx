import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { useSession, can } from '../lib/session';
import { dayLabel, number } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Notifications — what needs attention now, and what visitors are being told.
 *
 * Alerts are worked out from the data every time this screen loads, so one that
 * has resolved simply disappears. Acknowledging one keeps it quiet for a few
 * hours; it comes back if the situation is still there afterwards.
 *
 * An announcement is written for visitors. A closure also shuts the days it
 * covers, so nothing can be sold for them — the number of passes already sold
 * is shown before it is published, because that is somebody's Sunday.
 */

const KINDS = {
  slot_full: ['Slot full', '🚧'],
  slot_almost_full: ['Slot almost full', '📈'],
  duplicate_attempts: ['Unusual refusals', '⚠️'],
  high_traffic: ['High traffic', '🚗'],
  staff_offline: ['Staff offline', '👤'],
  payment_failures: ['Payment failures', '💳'],
  system_issue: ['System issue', '🔌'],
  closure: ['Closure', '🔒'],
  announcement: ['Announcement', '📣'],
};

const TONES = {
  critical: 'border-wrong-500/30 bg-wrong-50',
  warning: 'border-watch-500/30 bg-watch-50',
  info: 'border-line bg-white',
};
const CHIPS = {
  critical: 'bg-wrong-500 text-white',
  warning: 'bg-watch-500 text-white',
  info: 'bg-shell text-muted',
};

export default function Notifications() {
  const { me } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ann, setAnn] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [showQuiet, setShowQuiet] = useState(false);

  const load = useCallback(() => Promise.all([api.alerts(), api.announcements()])
    .then(([a, b]) => { setData(a); setAnn(b); setError(null); })
    .catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  /* A watched screen: refreshed every half-minute, without a spinner. */
  useEffect(() => {
    const t = setInterval(() => { api.alerts().then(setData).catch(() => {}); }, 30000);
    return () => clearInterval(t);
  }, []);

  const canAct = can(me, 'alerts.act');
  const canPublish = can(me, 'announcements.manage');

  return (
    <Shell title="Notifications — Alerts & Announcements"
      subtitle={data ? `${number(data.counts.critical)} needing attention · ${number(data.counts.warning)} to watch · checked ${when(data.at)}` : 'Operational alerts and visitor communications'}
      actions={canPublish && <button type="button" className="btn-primary !py-1.5 text-2xs" onClick={() => setDialog({ kind: 'new' })}>New announcement</button>}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data && !error && <Loading rows={4} />}

      {data && (
        <div className="space-y-7">
          <section>
            <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Alerts</h2>
                <p className="text-2xs text-muted">Worked out from what is happening now — nothing to clear by hand</p>
              </div>
              {data.acknowledged.length > 0 && (
                <button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={() => setShowQuiet((x) => !x)}>
                  {showQuiet ? 'Hide' : 'Show'} {number(data.acknowledged.length)} acknowledged
                </button>
              )}
            </div>

            {data.alerts.length === 0 ? (
              <div className="card px-4 py-12 text-center">
                <div className="text-2xl" aria-hidden>✓</div>
                <p className="mt-2 text-sm font-medium text-ink">Nothing needs attention</p>
                <p className="text-2xs text-muted">Slots have room, the gates are manned, and payments are going through.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {data.alerts.map((a) => (
                  <li key={a.key} className={`card border p-4 ${TONES[a.severity]}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base" aria-hidden>{(KINDS[a.kind] || [])[1] || '•'}</span>
                          <span className="text-sm font-semibold text-ink">{a.title}</span>
                          <span className={`chip ${CHIPS[a.severity]}`}>{a.severity === 'critical' ? 'Needs attention' : a.severity === 'warning' ? 'Watch' : 'For information'}</span>
                          <span className="chip bg-white/70 text-muted">{(KINDS[a.kind] || [a.kind])[0]}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-body">{a.detail}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {a.link && <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => navigate(a.link)}>Open</button>}
                        {a.announcementId && canPublish && (
                          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => setDialog({ kind: 'end', id: a.announcementId, title: a.title })}>End</button>
                        )}
                        {canAct && !a.announcementId && (
                          <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => setDialog({ kind: 'ack', alert: a })}>Acknowledge</button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {showQuiet && data.acknowledged.length > 0 && (
              <ul className="mt-3 space-y-2">
                {data.acknowledged.map((a) => (
                  <li key={a.key} className="card flex flex-wrap items-center justify-between gap-3 p-3 opacity-70">
                    <div>
                      <div className="text-sm text-ink">{a.title}</div>
                      <div className="text-2xs text-muted">Quiet until {when(a.quietUntil)}{a.note ? ` · ${a.note}` : ''}</div>
                    </div>
                    {canAct && <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={async () => { await api.unackAlert(a.key); load(); }}>Bring back</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2.5">
              <h2 className="text-[15px] font-semibold text-ink">Announcements</h2>
              <p className="text-2xs text-muted">What visitors are told — a closure also stops bookings for the days it covers</p>
            </div>
            {!ann ? <Loading rows={2} /> : ann.announcements.length === 0 ? (
              <p className="card px-4 py-10 text-center text-sm text-muted">No announcements yet.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="border-b border-line bg-shell">
                    <tr><th className="th">Announcement</th><th className="th">Kind</th><th className="th">Destination</th><th className="th">Dates</th><th className="th">Status</th><th className="th">By</th>{canPublish && <th className="th" />}</tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ann.announcements.map((a) => (
                      <tr key={a.id} className={a.active ? '' : 'opacity-60'}>
                        <td className="td"><div className="text-sm font-medium text-ink">{a.title}</div><div className="max-w-md text-2xs text-muted">{a.message}</div></td>
                        <td className="td"><span className={`chip ${a.kind === 'closure' ? 'bg-wrong-50 text-wrong-700' : a.kind === 'weather' ? 'bg-watch-50 text-watch-700' : 'bg-shell text-muted'}`}>{a.kind === 'closure' ? 'Closure' : a.kind === 'weather' ? 'Weather' : 'Notice'}</span></td>
                        <td className="td text-sm">{a.place || 'All destinations'}</td>
                        <td className="td whitespace-nowrap text-sm">{dayLabel(a.startsOn)}{a.endsOn !== a.startsOn ? ` – ${dayLabel(a.endsOn)}` : ''}</td>
                        <td className="td">
                          {a.live ? <span className="chip bg-good-50 text-good-700">Showing now</span>
                            : a.active ? <span className="chip bg-brand/10 text-brand">Scheduled</span>
                              : <span className="chip bg-shell text-muted">Ended</span>}
                          {a.daysClosed > 0 && <div className="mt-1 text-2xs text-wrong-700">{number(a.daysClosed)} day{a.daysClosed === 1 ? '' : 's'} closed</div>}
                        </td>
                        <td className="td text-2xs text-muted">{a.createdBy}<div>{when(a.createdAt)}</div></td>
                        {canPublish && (
                          <td className="td text-right">
                            {a.active && <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setDialog({ kind: 'end', id: a.id, title: a.title })}>End</button>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {dialog?.kind === 'ack' && (
        <AckDialog alert={dialog.alert} onClose={() => setDialog(null)}
          onDone={(out) => { setDialog(null); setNotice(`Acknowledged — quiet for ${out.quietHours} hours.`); load(); }} />
      )}
      {dialog?.kind === 'new' && (
        <AnnouncementForm places={ann?.places || []} today={ann?.today} onClose={() => setDialog(null)}
          onDone={(out) => {
            setDialog(null);
            setNotice(out.affected?.passes
              ? `Published. ${number(out.affected.passes)} pass${out.affected.passes === 1 ? '' : 'es'} already sold for those dates — decide what to do about them under Ticket management.`
              : 'Published.');
            load();
          }} />
      )}
      {dialog?.kind === 'end' && (
        <EndDialog id={dialog.id} title={dialog.title} onClose={() => setDialog(null)}
          onDone={(out) => { setDialog(null); setNotice(out.reopened ? `Ended. ${number(out.reopened)} day${out.reopened === 1 ? '' : 's'} open for booking again.` : 'Ended.'); load(); }} />
      )}
    </Shell>
  );
}

function AckDialog({ alert, onClose, onDone }) {
  const [hours, setHours] = useState(6);
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Acknowledge this alert" subtitle={alert.title} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy}
          onClick={async () => { const out = await run(() => api.ackAlert(alert.key, hours, note)); if (out) onDone(out); }}>
          {busy ? 'Saving…' : 'Acknowledge'}
        </button>
      </>}>
      <p className="text-sm text-body">It stays out of the list for a while. If the situation is still there afterwards, it comes back.</p>
      <Field label="Keep quiet for">
        <select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {[1, 3, 6, 12, 24].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>)}
        </select>
      </Field>
      <Field label="Note" hint="What you did or checked — others will see it"><input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function AnnouncementForm({ places, today, onClose, onDone }) {
  const [f, setF] = useState({ kind: 'notice', placeId: '', title: '', message: '', messageKn: '', startsOn: today || '', endsOn: today || '' });
  const [hit, setHit] = useState(null);
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (f.kind !== 'closure' || !f.startsOn || !f.endsOn || f.endsOn < f.startsOn) { setHit(null); return undefined; }
    let alive = true;
    api.announcementAffected({ placeId: f.placeId, from: f.startsOn, to: f.endsOn })
      .then((d) => { if (alive) setHit(d); }).catch(() => {});
    return () => { alive = false; };
  }, [f.kind, f.placeId, f.startsOn, f.endsOn]);

  const ready = f.title.trim().length >= 3 && f.message.trim().length >= 10 && f.startsOn && f.endsOn
    && f.endsOn >= f.startsOn && (f.kind !== 'closure' || f.placeId);

  return (
    <Modal title="New announcement" subtitle="Visitors see the title and message" onClose={onClose} busy={busy} wide
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={f.kind === 'closure' ? 'btn bg-wrong-500 text-white hover:bg-wrong-700' : 'btn-primary'} disabled={busy || !ready}
          onClick={async () => { const out = await run(() => api.publishAnnouncement(f)); if (out) onDone(out); }}>
          {busy ? 'Publishing…' : f.kind === 'closure' ? 'Close these dates' : 'Publish'}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind">
          <select className="input" value={f.kind} onChange={set('kind')}>
            <option value="notice">Notice — information only</option>
            <option value="weather">Weather warning — information only</option>
            <option value="closure">Closure — also stops bookings</option>
          </select>
        </Field>
        <Field label="Destination" hint={f.kind === 'closure' ? 'A closure must name one' : 'Leave empty for all destinations'}>
          <select className="input" value={f.placeId} onChange={set('placeId')}>
            <option value="">All destinations</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="From"><input type="date" className="input" value={f.startsOn} onChange={set('startsOn')} /></Field>
        <Field label="To"><input type="date" className="input" min={f.startsOn || undefined} value={f.endsOn} onChange={set('endsOn')} /></Field>
        <Field label="Title" className="sm:col-span-2"><input className="input" value={f.title} maxLength={120} onChange={set('title')} placeholder="Mullayanagiri closed — landslide on the ghat road" /></Field>
        <Field label="Message for visitors" className="sm:col-span-2">
          <textarea className="input min-h-[80px]" value={f.message} maxLength={600} onChange={set('message')}
            placeholder="The approach road is blocked. Bookings are closed until the road is cleared; anyone holding a pass for these dates will be contacted." />
        </Field>
        <Field label="Message in Kannada" className="sm:col-span-2" hint="Shown to visitors who chose Kannada">
          <textarea className="input min-h-[60px]" value={f.messageKn} maxLength={600} onChange={set('messageKn')} />
        </Field>
      </div>

      {f.kind === 'closure' && (
        <Banner tone={hit?.passes ? 'wrong' : 'watch'}>
          {hit === null ? 'Choose the destination and dates to see what this affects.'
            : hit.passes === 0 ? 'No passes are sold for these dates. Closing them affects nobody.'
              : `${number(hit.passes)} pass${hit.passes === 1 ? '' : 'es'} worth ₹${hit.amount.toLocaleString('en-IN')} are already sold to ${number(hit.visitors)} visitor${hit.visitors === 1 ? '' : 's'} for these dates. They stay valid — cancel or refund them yourself if that is what you mean to do.`}
        </Banner>
      )}
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function EndDialog({ id, title, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="End this announcement" subtitle={title} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Keep it</button>
        <button type="button" className="btn-primary" disabled={busy || !reasonOk(reason)}
          onClick={async () => { const out = await run(() => api.endAnnouncement(id, reason)); if (out) onDone(out); }}>
          {busy ? 'Ending…' : 'End it'}
        </button>
      </>}>
      <p className="text-sm text-body">Visitors stop seeing it. If it closed any days, those days open for booking again — unless another closure still covers them.</p>
      <Reason value={reason} onChange={setReason} placeholder="e.g. Road cleared, PWD confirmed at 9am" />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
