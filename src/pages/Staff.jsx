/**
 * The people at the gate and the phones they scan with.
 *
 * Two rules the department asked for, made visible here rather than buried in
 * the back-end: one staff member can hold only one gate at a time, and one
 * checkpost has only one scanning phone live at a time. The "on duty" marker on
 * a row is that rule showing its work.
 *
 * A PIN is displayed exactly once, at the moment it is issued, and is never
 * recoverable afterwards — only resettable. That is deliberate: a PIN an
 * administrator can look up later is a PIN that identifies nobody.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { when, num } from '../lib/format';
import { PageHead, Section, Table, Pill, Loading, Confirm, Field } from '../components/ui';

export default function Staff({ admin }) {
  const [staff, setStaff] = useState(null);
  const [devices, setDevices] = useState([]);
  const [checkposts, setCheckposts] = useState([]);
  const [issued, setIssued] = useState(null);      // { name, pin } — shown once
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', checkpost_ids: [] });
  const [newDevice, setNewDevice] = useState(null);
  const [revoke, setRevoke] = useState(null);

  async function load() {
    const [s, d, c] = await Promise.all([
      api.get('/staff', { quiet: true }),
      api.get('/devices', { quiet: true }),
      api.get('/checkposts', { quiet: true }),
    ]);
    setStaff(s.rows); setDevices(d.rows); setCheckposts(c.rows);
  }
  useEffect(() => { load(); }, []);

  async function addStaff(e) {
    e.preventDefault();
    const ids = form.checkpost_ids.length ? form.checkpost_ids : checkposts.map((c) => c.id);
    const r = await api.post('/staff', { ...form, checkpost_ids: ids });
    setIssued({ name: r.staff.name, pin: r.pin });
    setAdding(false); setForm({ name: '', mobile: '', checkpost_ids: [] });
    load();
  }

  async function resetPin(row) {
    const r = await api.post(`/staff/${row.id}/reset-pin`, {});
    setIssued({ name: row.name, pin: r.pin });
    load();
  }

  async function toggleActive(row) {
    await api.post(`/staff/${row.id}/active`, { is_active: !row.is_active });
    load();
  }

  async function addDevice(checkpostId, label) {
    const r = await api.post('/devices', { checkpost_id: checkpostId, label });
    setNewDevice({ label, url: r.setup_url });
    load();
  }

  return (
    <>
      <PageHead title="Staff & devices"
                subtitle="Who may scan, where, and on which phone.">
        {admin.can_write && (
          <button className="btn-primary" onClick={() => setAdding(true)}>Add staff member</button>
        )}
      </PageHead>

      <Section title="Checkpost staff"
               note="One person can hold one gate at a time. Signing in elsewhere ends their other session."
               className="mb-5">
        {!staff ? <Loading what="Loading staff" /> : (
          <Table
            columns={[
              { key: 'name', label: 'Name',
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-2xs text-ink-500">
                      {(r.checkposts || []).map((c) => c.name).join(', ') || 'no checkpost assigned'}
                    </div>
                  </div>
                ) },
              { key: 'on_duty', label: 'Status',
                render: (r) => !r.is_active ? <Pill tone="muted">Inactive</Pill>
                  : r.on_duty_since ? <Pill tone="allowed">On duty</Pill>
                  : <Pill tone="muted">Off duty</Pill> },
              { key: 'on_duty_since', label: 'Signed in',
                render: (r) => <span className="text-ink-500 text-xs">
                  {r.on_duty_since ? when(r.on_duty_since) : '—'}</span> },
              { key: 'scans_today', label: 'Scans today', align: 'right',
                render: (r) => num(r.scans_today) },
              { key: 'locked_until', label: 'PIN',
                render: (r) => r.locked_until && new Date(r.locked_until) > new Date()
                  ? <Pill tone="refused">Locked</Pill>
                  : <span className="text-ink-400 text-xs">••••••</span> },
              ...(admin.can_write ? [{
                key: 'actions', label: '', align: 'right',
                render: (r) => (
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost !py-1 !px-2 !text-xs"
                            onClick={() => resetPin(r)}>Reset PIN</button>
                    <button className="btn-ghost !py-1 !px-2 !text-xs"
                            onClick={() => toggleActive(r)}>
                      {r.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ),
              }] : []),
            ]}
            rows={staff}
            empty="No staff have been added yet."
          />
        )}
      </Section>

      <Section title="Gate phones"
               note="A phone is bound to one checkpost by opening its link once. Only one phone per gate can scan at a time.">
        <Table
          columns={[
            { key: 'label', label: 'Phone',
              render: (r) => (
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-2xs text-ink-500">{r.checkpost_name}</div>
                </div>
              ) },
            { key: 'in_use_by', label: 'In use by',
              render: (r) => r.in_use_by
                ? <Pill tone="allowed">{r.in_use_by}</Pill>
                : <span className="text-ink-400 text-xs">idle</span> },
            { key: 'last_seen_at', label: 'Last seen',
              render: (r) => <span className="text-ink-500 text-xs">
                {r.last_seen_at ? when(r.last_seen_at) : 'never'}</span> },
            { key: 'status', label: 'Status',
              render: (r) => r.revoked_at
                ? <Pill tone="refused">Withdrawn</Pill>
                : <Pill tone="muted">Registered</Pill> },
            ...(admin.can_write ? [{
              key: 'actions', label: '', align: 'right',
              render: (r) => r.revoked_at ? null : (
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost !py-1 !px-2 !text-xs"
                          onClick={() => setNewDevice({ label: r.label, url: r.setup_url })}>
                    Show link
                  </button>
                  <button className="btn-ghost !py-1 !px-2 !text-xs text-refused"
                          onClick={() => setRevoke(r)}>Withdraw</button>
                </div>
              ),
            }] : []),
          ]}
          rows={devices}
          empty="No phones registered yet."
        />

        {admin.can_write && checkposts.map((c) => (
          <button key={c.id} className="btn-ghost mt-3 mr-2"
                  onClick={() => addDevice(c.id, `Gate phone ${devices.length + 1}`)}>
            Register a phone for {c.name}
          </button>
        ))}
      </Section>

      {/* Add staff */}
      <Confirm
        open={adding}
        title="Add a staff member"
        confirmLabel="Create and issue a PIN"
        onCancel={() => setAdding(false)}
        onConfirm={addStaff}
        body={
          <div className="space-y-3">
            <Field label="Name">
              <input className="input" value={form.name} autoFocus
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile (optional)"
                   hint="Only for your records. Staff sign in with a PIN, not a number.">
              <input className="input tnum" value={form.mobile}
                     onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Checkposts"
                   hint="A PIN only works at the checkpost the person is assigned to.">
              <div className="space-y-1">
                {checkposts.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox"
                           checked={form.checkpost_ids.includes(c.id)}
                           onChange={(e) => setForm({
                             ...form,
                             checkpost_ids: e.target.checked
                               ? [...form.checkpost_ids, c.id]
                               : form.checkpost_ids.filter((x) => x !== c.id),
                           })} />
                    {c.name}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        }
      />

      {/* The PIN, shown once */}
      <Confirm
        open={!!issued}
        title={`PIN for ${issued?.name}`}
        confirmLabel="I have noted it down"
        onCancel={() => setIssued(null)}
        onConfirm={() => setIssued(null)}
        body={
          <>
            <div className="my-3 rounded-lg bg-paper-sunken py-5 text-center">
              <div className="font-mono text-4xl font-semibold tracking-[0.35em] text-ink-900">
                {issued?.pin}
              </div>
            </div>
            <p>
              Give this to {issued?.name} directly. It is not stored in a readable form and cannot
              be looked up later — if it is lost, issue a new one.
            </p>
          </>
        }
      />

      {/* A device link */}
      <Confirm
        open={!!newDevice}
        title={`Set-up link · ${newDevice?.label}`}
        confirmLabel="Done"
        onCancel={() => setNewDevice(null)}
        onConfirm={() => setNewDevice(null)}
        body={
          <>
            <p>Open this once on that phone. It registers the phone to the checkpost and is then
               remembered — the staff member only needs their PIN afterwards.</p>
            <div className="my-3 rounded-md bg-paper-sunken p-3 font-mono text-2xs break-all">
              {newDevice?.url}
            </div>
            <button className="btn-ghost w-full"
                    onClick={() => navigator.clipboard?.writeText(newDevice.url)}>
              Copy link
            </button>
          </>
        }
      />

      {/* Withdraw a phone */}
      <Confirm
        open={!!revoke}
        danger
        title={`Withdraw ${revoke?.label}?`}
        confirmLabel="Withdraw this phone"
        onCancel={() => setRevoke(null)}
        onConfirm={async () => {
          await api.post(`/devices/${revoke.id}/revoke`, {});
          setRevoke(null); load();
        }}
        body={
          <p>
            The phone stops working immediately and anyone signed in on it is signed out. Use this
            when a phone is lost or replaced. Scans already recorded from it are kept.
          </p>
        }
      />
    </>
  );
}
