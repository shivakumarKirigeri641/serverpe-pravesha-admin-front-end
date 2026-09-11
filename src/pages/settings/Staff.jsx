import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { clock, number, plate } from '../../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, Secret, Status, useAction, when } from '../../components/ui.jsx';

const VERDICT = {
  valid: ['Entered', 'bg-good-50 text-good-700'],
  used: ['Already used', 'bg-wrong-50 text-wrong-700'],
  invalid: ['Invalid', 'bg-wrong-50 text-wrong-700'],
  wrong_day: ['Wrong day', 'bg-watch-50 text-watch-700'],
  wrong_slot: ['Outside slot', 'bg-watch-50 text-watch-700'],
  override: ['Admitted anyway', 'bg-watch-50 text-watch-700'],
};

/*
 * Checkpost staff — the people who use the gate app. They sign in with their
 * mobile and a six-digit PIN, and can only verify vehicles at the checkposts
 * they are posted to. A PIN is generated here and shown once.
 */
export default function Staff() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [secret, setSecret] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(() => api.staff().then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (loadError) return <Banner tone="wrong">{loadError}</Banner>;
  if (!data) return <Loading />;

  const open = (kind, person = null) => { setDone(null); setSecret(null); setDialog({ kind, person }); };
  const finished = (message, pin, person) => {
    setDialog(null);
    if (pin) setSecret({ pin, name: person });
    else setDone(message);
    load();
  };

  const onDuty = data.staff.filter((s) => s.onDutySince).length;

  return (
    <div className="space-y-5">
      {done && <Banner tone="good">{done}</Banner>}
      {secret && (
        <div className="space-y-2">
          <Secret label={`Gate app PIN for ${secret.name}`} value={secret.pin}
            note="Shown only this once. Give it to them in person or by phone; they sign in with their mobile number and this PIN." />
          <button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={() => setSecret(null)}>I have shared it</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {number(data.staff.filter((s) => s.active).length)} active · {number(onDuty)} on duty now · {data.checkposts.length} checkpost{data.checkposts.length === 1 ? '' : 's'}
        </p>
        <button type="button" className="btn-primary" onClick={() => open('add')}>Add staff member</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Name</th><th className="th">Posted to</th><th className="th">Status</th>
              <th className="th text-right">Checks today</th><th className="th text-right">Last 7 days</th><th className="th">Last check</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.staff.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'bg-shell/40'}>
                <td className="td">
                  <div className="font-medium text-ink">{s.name}</div>
                  <div className="text-2xs text-muted">{s.mobile}</div>
                </td>
                <td className="td text-sm">{s.checkposts.map((c) => c.name).join(', ') || '—'}</td>
                <td className="td">
                  <div className="flex flex-wrap items-center gap-1">
                    <Status active={s.active} locked={s.locked} />
                    {s.onDutySince && <span className="chip bg-brand/10 text-brand">On duty since {clock(s.onDutySince)}</span>}
                  </div>
                </td>
                <td className="td tabular text-right">{number(s.checksToday)}</td>
                <td className="td tabular text-right">{number(s.checksWeek)}</td>
                <td className="td text-2xs text-muted">{when(s.lastCheck)}</td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => open('activity', s)}>Activity</button>
                    <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => open('edit', s)}>Edit</button>
                    <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => open('pin', s)}>Reset PIN</button>
                    <button type="button" className={`btn-quiet !px-2.5 !py-1 text-2xs ${s.active ? 'text-wrong-700' : 'text-good-700'}`}
                      onClick={() => open('active', s)}>{s.active ? 'Disable' : 'Enable'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Banner>
        Gate staff can verify a vehicle, see the vehicle in hand and their own checks — nothing else. Disabling someone or resetting their PIN ends their shift on the gate app at once.
      </Banner>

      {dialog?.kind === 'add' && <StaffForm checkposts={data.checkposts} onClose={() => setDialog(null)} onSaved={finished} />}
      {dialog?.kind === 'edit' && <StaffForm person={dialog.person} checkposts={data.checkposts} onClose={() => setDialog(null)} onSaved={finished} />}
      {dialog?.kind === 'pin' && <Confirm title="Reset PIN" person={dialog.person} action="Reset PIN"
        text="A new six-digit PIN is generated and shown once. Their current shift on the gate app ends."
        onClose={() => setDialog(null)} submit={(reason) => api.resetStaffPin(dialog.person.id, reason)}
        onDone={(out) => finished(null, out.pin, dialog.person.name)} />}
      {dialog?.kind === 'active' && <Confirm title={dialog.person.active ? 'Disable staff member' : 'Enable staff member'} person={dialog.person}
        action={dialog.person.active ? 'Disable' : 'Enable'} danger={dialog.person.active}
        text={dialog.person.active ? 'They will not be able to sign in to the gate app, and any shift in progress ends now. Their past checks stay on record.' : 'They will be able to sign in with their existing PIN.'}
        onClose={() => setDialog(null)} submit={(reason) => api.setStaffActive(dialog.person.id, !dialog.person.active, reason)}
        onDone={() => finished(`${dialog.person.name} ${dialog.person.active ? 'disabled' : 'enabled'}.`)} />}
      {dialog?.kind === 'activity' && <Activity person={dialog.person} onClose={() => setDialog(null)} />}
    </div>
  );
}

function StaffForm({ person, checkposts, onClose, onSaved }) {
  const [name, setName] = useState(person?.name || '');
  const [mobile, setMobile] = useState('');
  const [posts, setPosts] = useState(() => new Set((person?.checkposts || (checkposts.length === 1 ? checkposts : [])).map((c) => String(c.id))));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();

  const toggle = (id) => setPosts((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const mobileOk = person ? (mobile === '' || /^\d{10}$/.test(mobile)) : /^\d{10}$/.test(mobile);

  async function save() {
    const body = { name, checkpostIds: [...posts], reason, ...(mobile ? { mobile } : {}) };
    const out = await run(() => (person ? api.updateStaff(person.id, body) : api.addStaff(body)));
    if (out) person ? onSaved(`${out.staff.name} updated.`) : onSaved(null, out.pin, out.staff.name);
  }

  return (
    <Modal title={person ? `Edit ${person.name}` : 'Add a staff member'} subtitle={person ? undefined : 'A PIN is generated for them when you save'}
      onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || name.trim().length < 2 || !mobileOk || !posts.size || !reasonOk(reason)}>
          {busy ? 'Saving…' : person ? 'Save changes' : 'Add and create PIN'}
        </button>
      </>}>
      <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Mobile number" hint={person ? `Currently ${person.mobile}. Leave empty to keep it.` : 'They sign in with this number'}>
        <input className="input tabular" inputMode="numeric" maxLength={10} value={mobile} placeholder="10 digits"
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
      </Field>
      <div>
        <span className="label">Posted to</span>
        <div className="space-y-1.5">
          {checkposts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={posts.has(String(c.id))} onChange={() => toggle(String(c.id))} />
              {c.name} <span className="text-2xs text-muted">· {c.place}</span>
            </label>
          ))}
        </div>
      </div>
      <Reason value={reason} onChange={setReason} placeholder="e.g. Joined the gate team for the Dasara season" />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

export function Confirm({ title, person, text, action, danger, submit, onDone, onClose }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title={title} subtitle={person?.name} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={danger ? 'btn bg-wrong-500 text-white hover:bg-wrong-700' : 'btn-primary'} disabled={busy || !reasonOk(reason)}
          onClick={async () => { const out = await run(() => submit(reason)); if (out) onDone(out); }}>
          {busy ? 'Working…' : action}
        </button>
      </>}>
      <p className="text-sm text-body">{text}</p>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function Activity({ person, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.staffActivity(person.id).then(setData).catch((e) => setError(e.message)); }, [person.id]);

  return (
    <Modal title={person.name} subtitle="Recent shifts and checks" onClose={onClose} wide>
      {error && <Banner tone="wrong">{error}</Banner>}
      {!data && !error && <Loading rows={3} />}
      {data && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="label">Shifts</div>
            {data.shifts.length === 0 ? <p className="text-sm text-muted">No shifts yet.</p> : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {data.shifts.map((s) => (
                  <li key={s.startedAt} className="px-3 py-2 text-sm">
                    <div className="text-ink">{when(s.startedAt)}</div>
                    <div className="text-2xs text-muted">
                      {s.endedAt ? `ended ${clock(s.endedAt)}${s.endedReason ? ` · ${s.endedReason.replace(/_/g, ' ')}` : ''}` : 'still on duty'} · {s.checkpost || '—'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="label">Last 50 checks</div>
            {data.checks.length === 0 ? <p className="text-sm text-muted">No checks yet.</p> : (
              <div className="max-h-96 overflow-auto rounded-lg border border-line">
                <table className="w-full">
                  <tbody className="divide-y divide-line">
                    {data.checks.map((c, i) => {
                      const [label, tone] = VERDICT[c.verdict] || [c.verdict, 'bg-shell text-muted'];
                      return (
                        <tr key={`${c.at}-${i}`}>
                          <td className="px-3 py-2 text-2xs text-muted whitespace-nowrap">{when(c.at)}</td>
                          <td className="px-3 py-2 font-mono text-sm text-ink">{plate(c.regNo) || c.ticketNo || '—'}</td>
                          <td className="px-3 py-2 text-right"><span className={`chip ${tone}`}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
