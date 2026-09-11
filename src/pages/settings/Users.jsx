import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Banner, Field, Loading, Modal, Reason, reasonOk, Secret, Status, useAction, when } from '../../components/ui.jsx';
import { Confirm } from './Staff.jsx';

/*
 * Panel users — who can sign in to this admin panel, and as which role. Only a
 * super administrator sees this. Passwords are generated, shown once, and never
 * shown again; nobody can change their own role or disable themselves, and the
 * last super administrator cannot be removed.
 */
export default function Users() {
  const { me } = useSession();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [secret, setSecret] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(() => api.users().then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (loadError) return <Banner tone="wrong">{loadError}</Banner>;
  if (!data) return <Loading />;

  const open = (kind, person = null) => { setDone(null); setSecret(null); setDialog({ kind, person }); };
  const finished = (message, password, name) => {
    setDialog(null);
    if (password) setSecret({ password, name }); else setDone(message);
    load();
  };

  return (
    <div className="space-y-5">
      {done && <Banner tone="good">{done}</Banner>}
      {secret && (
        <div className="space-y-2">
          <Secret label={`Password for ${secret.name}`} value={secret.password}
            note="Shown only this once. They sign in with their mobile number and this password; any session they had open has ended." />
          <button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={() => setSecret(null)}>I have shared it</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{data.users.filter((u) => u.active).length} active panel users</p>
        <button type="button" className="btn-primary" onClick={() => open('add')}>Add panel user</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-line bg-shell">
            <tr><th className="th">Name</th><th className="th">Role</th><th className="th">Status</th><th className="th">Last sign-in</th><th className="th text-right">Sessions</th><th className="th text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.users.map((u) => {
              const self = u.id === String(me?.id);
              return (
                <tr key={u.id} className={u.active ? '' : 'bg-shell/40'}>
                  <td className="td">
                    <div className="font-medium text-ink">{u.name}{self && <span className="chip ml-2 bg-brand/10 text-brand">You</span>}</div>
                    <div className="text-2xs text-muted">{u.mobile}</div>
                  </td>
                  <td className="td text-sm text-ink">{u.roleLabel}</td>
                  <td className="td"><Status active={u.active} locked={u.locked} /></td>
                  <td className="td text-2xs text-muted">{when(u.lastLogin)}</td>
                  <td className="td tabular text-right">{u.openSessions}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => open('edit', u)}>Edit</button>
                      <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => open('password', u)}>Reset password</button>
                      <button type="button" className={`btn-quiet !px-2.5 !py-1 text-2xs ${u.active ? 'text-wrong-700' : 'text-good-700'}`}
                        disabled={self} title={self ? 'You cannot disable your own account' : undefined}
                        onClick={() => open('active', u)}>{u.active ? 'Disable' : 'Enable'}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <UserForm person={dialog.person} roles={data.roles} self={dialog.person?.id === String(me?.id)}
          onClose={() => setDialog(null)} onSaved={finished} />
      )}
      {dialog?.kind === 'password' && <Confirm title="Reset password" person={dialog.person} action="Reset password"
        text="A new password is generated and shown once. Every session they have open ends now."
        onClose={() => setDialog(null)} submit={(reason) => api.resetUserPassword(dialog.person.id, reason)}
        onDone={(out) => finished(null, out.password, dialog.person.name)} />}
      {dialog?.kind === 'active' && <Confirm title={dialog.person.active ? 'Disable panel user' : 'Enable panel user'} person={dialog.person}
        action={dialog.person.active ? 'Disable' : 'Enable'} danger={dialog.person.active}
        text={dialog.person.active ? 'They are signed out everywhere and cannot sign in. Everything they did stays in the audit trail.' : 'They can sign in again with their current password.'}
        onClose={() => setDialog(null)} submit={(reason) => api.setUserActive(dialog.person.id, !dialog.person.active, reason)}
        onDone={() => finished(`${dialog.person.name} ${dialog.person.active ? 'disabled' : 'enabled'}.`)} />}
    </div>
  );
}

function UserForm({ person, roles, self, onClose, onSaved }) {
  const [name, setName] = useState(person?.name || '');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState(person?.role || 'viewer');
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();

  async function save() {
    const out = await run(() => (person
      ? api.updateUser(person.id, { name, role, reason })
      : api.addUser({ name, mobile, role, reason })));
    if (out) person ? onSaved(`${name} updated.`) : onSaved(null, out.password, out.user.name);
  }

  return (
    <Modal title={person ? `Edit ${person.name}` : 'Add a panel user'} subtitle={person ? undefined : 'A password is generated when you save'}
      onClose={onClose} busy={busy} wide
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save}
          disabled={busy || name.trim().length < 2 || (!person && !/^\d{10}$/.test(mobile)) || !reasonOk(reason)}>
          {busy ? 'Saving…' : person ? 'Save changes' : 'Add and create password'}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {!person && (
          <Field label="Mobile number" hint="They sign in with this number">
            <input className="input tabular" inputMode="numeric" maxLength={10} value={mobile} placeholder="10 digits"
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
      </div>
      <div>
        <span className="label">Role</span>
        {self && <p className="mb-2 text-2xs text-watch-700">You cannot change your own role. Another super admin can.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <label key={r.key} className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${role === r.key ? 'border-brand bg-brand/5' : 'border-line'} ${self ? 'cursor-not-allowed opacity-60' : ''}`}>
              <input type="radio" name="role" className="mt-1 h-4 w-4 accent-brand" checked={role === r.key} disabled={self} onChange={() => setRole(r.key)} />
              <span>
                <span className="block text-sm font-semibold text-ink">{r.label}</span>
                <span className="block text-2xs text-muted">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
