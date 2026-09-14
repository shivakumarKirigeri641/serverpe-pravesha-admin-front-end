import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession, can } from '../lib/session';
import { Banner, Modal, Reason, reasonOk, useAction, when } from './ui.jsx';
import { useToast } from './Toast.jsx';

/*
 * Whether a vehicle is on the watchlist, on its own page — and the controls to
 * change that, for whoever is allowed to.
 *
 * Blocked stops the vehicle at every gate whatever pass it holds; Check carefully
 * lets it through with a warning to the staff member. Both need a reason, and the
 * reason is what the gate shows.
 */
export const LEVELS = [
  ['check', 'Check carefully', 'The gate lets it in, and shows the staff member your reason first.'],
  ['block', 'Blocked', 'Every gate refuses it, whatever pass it holds, and tells staff to call the office.'],
];

export default function WatchPanel({ regNo }) {
  const { me } = useSession();
  const [entry, setEntry] = useState(undefined);
  const [dialog, setDialog] = useState(null);
  const manage = can(me, 'watchlist.manage');

  const load = useCallback(() => api.watchFor(regNo).then((d) => setEntry(d.entry)).catch(() => setEntry(null)), [regNo]);
  useEffect(() => { load(); }, [load]);

  if (entry === undefined) return null;

  return (
    <>
      {entry ? (
        <Banner tone={entry.level === 'block' ? 'wrong' : 'warn'}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <b>{entry.level === 'block' ? 'On the watchlist — blocked at every gate.' : 'On the watchlist — staff check it carefully.'}</b>
              <div className="mt-0.5">Reason: {entry.reason}</div>
              <div className="text-2xs opacity-80">Since {when(entry.since)}</div>
            </div>
            {manage && (
              <div className="flex gap-1.5">
                <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setDialog('edit')}>Change</button>
                <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setDialog('remove')}>Take off the list</button>
              </div>
            )}
          </div>
        </Banner>
      ) : manage ? (
        <div className="mb-4 flex justify-end">
          <button type="button" className="btn-quiet text-2xs" onClick={() => setDialog('edit')}>⚠ Add to watchlist</button>
        </div>
      ) : null}

      {dialog === 'edit' && <WatchForm regNo={regNo} current={entry} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog === 'remove' && <RemoveForm regNo={regNo} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
    </>
  );
}

export function WatchForm({ regNo: fixedPlate = null, current = null, onClose, onDone }) {
  const [regNo, setRegNo] = useState(fixedPlate || '');
  const [level, setLevel] = useState(current?.level || 'check');
  const [reason, setReason] = useState(current?.reason || '');
  const { busy, error, run } = useAction();
  const plateOk = /^[A-Z0-9]{4,17}$/.test(regNo);

  const toast = useToast();

  async function save() {
    const out = await run(() => api.watchAdd({ regNo, level, reason }));
    if (out) {
      toast.good(`${out.entry.regNo} is ${out.entry.level === 'block' ? 'blocked at every gate' : 'flagged for a closer look'}.`);
      onDone(out);
    }
  }

  return (
    <Modal title={current ? `Change watchlist entry` : 'Add to the watchlist'} subtitle={fixedPlate || undefined} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={level === 'block' ? 'btn bg-wrong-500 text-white hover:bg-wrong-700' : 'btn-primary'}
          disabled={busy || !plateOk || !reasonOk(reason)} onClick={save}>
          {busy ? 'Saving…' : level === 'block' ? 'Block this vehicle' : 'Save'}
        </button>
      </>}>
      {!fixedPlate && (
        <label className="block">
          <span className="label">Vehicle number</span>
          <input className="input font-mono uppercase" value={regNo} placeholder="KA01AB1234"
            onChange={(e) => setRegNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        </label>
      )}
      <div className="space-y-2">
        {LEVELS.map(([key, label, hint]) => (
          <label key={key} className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${level === key ? (key === 'block' ? 'border-wrong-500 bg-wrong-50' : 'border-warn-500 bg-warn-50') : 'border-line'}`}>
            <input type="radio" name="level" className="mt-1" checked={level === key} onChange={() => setLevel(key)} />
            <span>
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block text-2xs text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      <Reason value={reason} onChange={setReason} placeholder="e.g. Argued at the barrier twice and forced entry on 12 September" />
      <p className="text-2xs text-muted">The gate shows this reason to the staff member.</p>
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

export function RemoveForm({ regNo, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  const toast = useToast();
  return (
    <Modal title="Take off the watchlist" subtitle={regNo} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy || !reasonOk(reason)}
          onClick={async () => {
            const out = await run(() => api.watchRemove(regNo, reason));
            if (out) { toast.good(`${regNo} is off the watchlist. Gates stop warning about it now.`); onDone(out); }
          }}>
          {busy ? 'Working…' : 'Take off the list'}
        </button>
      </>}>
      <p className="text-sm text-body">Gates stop warning about this vehicle straight away. The entry stays in the history with your reason.</p>
      <Reason value={reason} onChange={setReason} placeholder="e.g. Cleared after speaking to the owner" />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
