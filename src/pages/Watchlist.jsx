import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { useSession, can } from '../lib/session';
import { plate } from '../lib/format';
import { Banner, Loading, when } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { RemoveForm, WatchForm } from '../components/WatchPanel.jsx';

/*
 * Watchlist — number plates the gate must stop, or look at twice.
 *
 * Blocked plates are refused at every gate, online or offline, whatever pass
 * they hold. Check-carefully plates go through with the reason shown to the
 * staff member first. Every change needs a reason and is in the audit trail;
 * a plate taken off the list stays in the history below.
 */
export default function Watchlist() {
  const { me } = useSession();
  const navigate = useNavigate();
  const manage = can(me, 'watchlist.manage');
  const [showRemoved, setShowRemoved] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api.watchlist({ removed: showRemoved })); setError(null); } catch (e) { setError(e.message); }
  }, [showRemoved]);
  useEffect(() => { load(); }, [load]);

  const rows = data?.entries || [];
  const toast = useToast();
  /* The dialog closes, the list redraws, and what happened is said once in the
     corner — the row that changed is several lines away and easy to miss. */
  const done = (said) => { setDialog(null); load(); if (said) toast.good(said); };

  return (
    <Shell
      title="Watchlist"
      subtitle={data ? `${data.counts.block} blocked · ${data.counts.check} to check carefully` : 'Loading…'}
      actions={manage && <button type="button" className="btn-primary" onClick={() => setDialog({ kind: 'add' })}>Add a vehicle</button>}
    >
      {error && <Banner tone="wrong">{error}</Banner>}

      <Banner>
        <b>Blocked</b> vehicles are refused at every gate, even without signal, whatever pass they hold. <b>Check carefully</b> lets
        them in after the staff member has read your reason. Every change is recorded in the audit trail.
      </Banner>

      <div className="mb-3 mt-4 flex gap-2">
        <button type="button" className={`btn-quiet text-2xs ${!showRemoved ? '!border-brand !text-brand' : ''}`} onClick={() => setShowRemoved(false)}>On the list</button>
        <button type="button" className={`btn-quiet text-2xs ${showRemoved ? '!border-brand !text-brand' : ''}`} onClick={() => setShowRemoved(true)}>Taken off</button>
      </div>

      {!data ? <Loading /> : rows.length === 0 ? (
        <div className="card px-5 py-12 text-center text-sm text-muted">{showRemoved ? 'Nothing has been taken off the list.' : 'No vehicle is on the watchlist.'}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-shell">
              <tr>
                <th className="th">Vehicle</th><th className="th">Level</th><th className="th">Reason</th>
                <th className="th">{showRemoved ? 'Taken off' : 'Added'}</th><th className="th">Last at a gate</th>
                {manage && !showRemoved && <th className="th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((w) => (
                <tr key={w.id} className="row-hover">
                  <td className="td">
                    <button type="button" className="font-mono font-semibold text-brand hover:underline" onClick={() => navigate(`/vehicles/${encodeURIComponent(w.regNo)}`)}>
                      {plate(w.regNo)}
                    </button>
                  </td>
                  <td className="td">
                    <span className={`chip ${w.level === 'block' ? 'bg-wrong-50 text-wrong-700' : 'bg-watch-50 text-watch-700'}`}>{w.level === 'block' ? 'Blocked' : 'Check carefully'}</span>
                  </td>
                  <td className="td text-body">
                    {w.reason}
                    {showRemoved && w.removedReason && <div className="text-2xs text-muted">Taken off: {w.removedReason}</div>}
                  </td>
                  <td className="td text-2xs text-muted">
                    {when(showRemoved ? w.removedAt : w.since)}
                    <div>{showRemoved ? (w.removedBy || '—') : (w.addedBy || '—')}</div>
                  </td>
                  <td className="td text-2xs text-muted">{w.lastSeenAtGate ? when(w.lastSeenAtGate) : 'Not seen'}</td>
                  {manage && !showRemoved && (
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setDialog({ kind: 'edit', entry: w })}>Change</button>
                        <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setDialog({ kind: 'remove', entry: w })}>Take off</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'add' && <WatchForm onClose={() => setDialog(null)} onDone={() => done()} />}
      {dialog?.kind === 'edit' && <WatchForm regNo={dialog.entry.regNo} current={dialog.entry} onClose={() => setDialog(null)} onDone={() => done()} />}
      {dialog?.kind === 'remove' && <RemoveForm regNo={dialog.entry.regNo} onClose={() => setDialog(null)} onDone={() => done()} />}
    </Shell>
  );
}
