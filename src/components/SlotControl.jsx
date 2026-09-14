import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { Banner, Loading, Modal, Reason, reasonOk, useAction } from './ui.jsx';
import { useToast } from './Toast.jsx';

/*
 * Today's controls for one slot, opened from its card on live monitoring.
 *
 * FEWER PLACES, OR NONE. Each vehicle type's number can be lowered or raised for
 * today — never below what is already booked or being paid for, because a smaller
 * number stops sales, it does not un-sell anybody. Or the slot is closed outright.
 *
 * CLOSING TELLS THE PEOPLE IT AFFECTS. Everybody holding an unused pass for the
 * slot can be sent a WhatsApp notice, in Kannada for those who chose it when a
 * Kannada version is written. The screen says how many that is before anything is
 * sent, and how many were actually reached afterwards.
 */
export default function SlotControl({ slotId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState('');
  const [edits, setEdits] = useState({});
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [messageKn, setMessageKn] = useState('');
  const [done, setDone] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const { busy, error: actionError, run } = useAction();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api.capacityToday();
      setData(d);
      setError(null);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const slot = data?.slots.find((s) => s.slotId === String(slotId)) || null;
  const name = slot ? String(slot.label).split(/\s+/)[0] : '';

  useEffect(() => {
    if (slot && !message) {
      setMessage(`Today's ${name} slot at ${data.place.name} is closed. We are sorry for the trouble — reply to this message and we will help with your pass.`);
    }
  }, [slot]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCapacity(cat) {
    const value = Number(edits[cat.categoryId]);
    const out = await run(() => api.capacitySet({ slotId: slot.slotId, categoryId: cat.categoryId, capacity: value, reason }));
    if (out) {
      toast.good(`${cat.label} in the ${name} slot: ${number(out.before)} → ${number(out.after)} places today.`);
      setDone(`${cat.label}: ${number(out.before)} → ${number(out.after)} places today.`);
      setEdits((e) => { const next = { ...e }; delete next[cat.categoryId]; return next; });
      await load();
      onChanged?.();
    }
  }

  async function close() {
    const out = await run(() => api.capacityClose({ slotId: slot.slotId, reason, notify: notify && slot.holders.passes > 0, message, messageKn }));
    setConfirmClose(false);
    if (out) {
      toast.warn(`The ${name} slot is closed for today.${out.notice ? ` ${number(out.notice.template + out.notice.chat)} of ${number(out.notice.total)} visitors told.` : ''}`);
      const nt = out.notice;
      setDone(nt
        ? `Closed. ${number(nt.template + nt.chat)} of ${number(nt.total)} visitors told on WhatsApp`
          + `${nt.chat ? ` (${number(nt.chat)} by chat message)` : ''}${nt.notReached ? ` · ${number(nt.notReached)} could not be reached — the notice template is not approved yet, or they have not written in 24 hours` : ''}`
          + `${nt.failed ? ` · ${number(nt.failed)} failed` : ''}.`
        : `Closed. ${number(out.affected.passes)} pass${out.affected.passes === 1 ? '' : 'es'} for this slot were not notified.`);
      await load();
      onChanged?.();
    }
  }

  async function reopen() {
    const out = await run(() => api.capacityReopen({ slotId: slot.slotId, reason }));
    if (out) {
      toast.good(`The ${name} slot is open again for today.`);
      setDone('Reopened for today. Sales and entry by booking are back on.');
      await load();
      onChanged?.();
    }
  }

  return (
    <Modal title={slot ? `${name} slot — today` : 'Today'} subtitle={slot ? `${data.place.name} · ${slot.startsAt}–${slot.endsAt}` : undefined}
      onClose={onClose} busy={busy} wide>
      {error && <Banner tone="wrong">{error}</Banner>}
      {!data && !error && <Loading rows={3} />}
      {data && !slot && <Banner tone="warn">That slot is not running today.</Banner>}

      {slot && (
        <>
          {done && <Banner tone="good">{done}</Banner>}
          {actionError && <Banner tone="wrong">{actionError}</Banner>}
          {!slot.isOpen && <Banner tone="wrong">Closed today{slot.closedNote ? ` — ${slot.closedNote}` : ''}.</Banner>}

          <Reason value={reason} onChange={setReason} placeholder="e.g. Fog on the ghat road — the police asked us to limit vehicles" />

          <section>
            <div className="label">Places for each vehicle type, today only</div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-shell">
                  <tr>
                    <th className="th">Vehicle</th><th className="th text-right">Booked</th><th className="th text-right">Paying now</th>
                    <th className="th text-right">Left</th><th className="th">Places today</th><th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {slot.categories.map((c) => {
                    const edited = edits[c.categoryId];
                    const value = edited === undefined ? String(c.capacity) : edited;
                    const minimum = c.booked + c.held;
                    const bad = value === '' || Number(value) < minimum || !Number.isInteger(Number(value));
                    return (
                      <tr key={c.categoryId}>
                        <td className="td font-medium text-ink">{c.label}</td>
                        <td className="td tabular text-right">{number(c.booked)}</td>
                        <td className="td tabular text-right text-muted">{number(c.held)}</td>
                        <td className="td tabular text-right">{number(c.remaining)}</td>
                        <td className="td">
                          <input className="input !w-24 tabular" inputMode="numeric" value={value}
                            onChange={(e) => setEdits((x) => ({ ...x, [c.categoryId]: e.target.value.replace(/\D/g, '') }))} />
                          {edited !== undefined && Number(value) < minimum && <div className="text-2xs text-wrong-700">At least {minimum}</div>}
                        </td>
                        <td className="td text-right">
                          <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs"
                            disabled={busy || edited === undefined || bad || Number(value) === c.capacity || !reasonOk(reason)}
                            onClick={() => saveCapacity(c)}>Save</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-2xs text-muted">A lower number stops further sales. It never cancels a pass somebody has already paid for.</p>
          </section>

          {slot.isOpen ? (
            <section className="rounded-lg border border-wrong-500/30 p-4">
              <div className="text-sm font-semibold text-ink">Close this slot for today</div>
              <p className="mt-0.5 text-2xs text-muted">
                No more passes are sold for it. {number(slot.holders.passes)} pass{slot.holders.passes === 1 ? '' : 'es'} already paid for
                ({number(slot.holders.visitors)} visitor{slot.holders.visitors === 1 ? '' : 's'}) — refunds or another date are handled in ticket management afterwards.
              </p>

              {slot.holders.passes > 0 && (
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="h-4 w-4 accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                    Tell the {number(slot.holders.visitors)} visitor{slot.holders.visitors === 1 ? '' : 's'} on WhatsApp
                  </label>
                  {notify && (
                    <>
                      <label className="block">
                        <span className="label">Notice (English)</span>
                        <textarea className="input min-h-[72px]" maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} />
                      </label>
                      <label className="block">
                        <span className="label">Notice (Kannada) — sent to visitors who chose Kannada</span>
                        <textarea className="input min-h-[72px]" maxLength={600} value={messageKn} onChange={(e) => setMessageKn(e.target.value)}
                          placeholder="ಇಂದಿನ ಸ್ಲಾಟ್ ಮುಚ್ಚಲಾಗಿದೆ… (leave empty to send the English notice)" />
                      </label>
                    </>
                  )}
                </div>
              )}

              {!confirmClose ? (
                <button type="button" className="btn mt-3 bg-wrong-500 text-white hover:bg-wrong-700"
                  disabled={busy || !reasonOk(reason) || (notify && slot.holders.passes > 0 && message.trim().length < 10)}
                  onClick={() => setConfirmClose(true)}>Close the slot…</button>
              ) : (
                <div className="mt-3 rounded-lg bg-wrong-50 p-3 text-sm text-wrong-700">
                  <b>Are you sure?</b> Sales stop now{notify && slot.holders.passes > 0 ? ` and ${number(slot.holders.visitors)} visitors are messaged` : ''}.
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-quiet" disabled={busy} onClick={() => setConfirmClose(false)}>Cancel</button>
                    <button type="button" className="btn bg-wrong-500 text-white hover:bg-wrong-700" disabled={busy} onClick={close}>
                      {busy ? 'Closing…' : 'Yes, close it'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-line p-4">
              <div className="text-sm font-semibold text-ink">Reopen this slot for today</div>
              <p className="mt-0.5 text-2xs text-muted">Sales start again at the numbers above.</p>
              <button type="button" className="btn-primary mt-3" disabled={busy || !reasonOk(reason)} onClick={reopen}>
                {busy ? 'Reopening…' : 'Reopen'}
              </button>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
