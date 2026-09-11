import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { dayLabel, number } from '../../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction } from '../../components/ui.jsx';

const ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

const lastEntry = (end) => {
  const [h, m] = String(end || '0:0').split(':').map(Number);
  const mins = Math.max(0, h * 60 + m - 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

const to12 = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/*
 * Slots and capacity. A slot is a window of hours with places per vehicle type,
 * optionally open only between two dates. Capacity changes reach every date
 * already open, and never take a place from someone who has booked it.
 */
export default function Slots() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(() => api.slots().then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (loadError) return <Banner tone="wrong">{loadError}</Banner>;
  if (!data) return <Loading />;

  const finished = (message, warnings) => { setEditing(null); setRemoving(null); setDone({ message, warnings }); load(); };

  return (
    <div className="space-y-5">
      {done && (
        <Banner tone={done.warnings?.length ? 'watch' : 'good'}>
          <div className="font-medium">{done.message}</div>
          {done.warnings?.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-2xs">
              {done.warnings.slice(0, 6).map((w) => (
                <li key={`${w.code}-${w.date}`}>{dayLabel(w.date)}: {w.label} already has {number(w.sold)} booked — above the new {number(w.capacity)}. Those passes stay valid.</li>
              ))}
            </ul>
          )}
        </Banner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {data.place.name} · entry closes an hour before a slot ends · slots may not overlap
        </p>
        <button type="button" className="btn-primary" onClick={() => { setDone(null); setEditing({}); }}>Add slot</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.slots.map((s) => (
          <article key={s.id} className={`card p-5 ${s.active ? '' : 'opacity-70'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink">{s.label.replace(/\s+/g, ' ')}</h3>
                <p className="mt-0.5 text-2xs text-muted">
                  {to12(s.startsAt)} – {to12(s.endsAt)} · last entry {to12(lastEntry(s.endsAt))}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {s.active ? <span className="chip bg-good-50 text-good-700">Open</span> : <span className="chip bg-shell text-muted">Inactive</span>}
                {(s.validFrom || s.validTo) && (
                  <span className="chip bg-watch-50 text-watch-700">
                    {s.validFrom ? dayLabel(s.validFrom) : 'Now'} → {s.validTo ? dayLabel(s.validTo) : 'no end'}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.categories.map((c) => (
                <div key={c.code} className="rounded-lg border border-line px-3 py-2">
                  <div className="text-2xs text-muted"><span aria-hidden>{ICON[c.code]}</span> {c.label}</div>
                  <div className="tabular text-lg font-bold text-ink">{number(s.capacities[c.code])}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-2xs text-muted">
                {number(s.capacity)} places a day · {number(s.upcoming)} upcoming pass{s.upcoming === 1 ? '' : 'es'} · {number(s.ticketsEver)} ever
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => { setDone(null); setEditing(s); }}>Edit</button>
                <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs text-wrong-700" onClick={() => { setDone(null); setRemoving(s); }}
                  title={s.deletable ? 'Delete this slot' : 'Slots with passes on record cannot be deleted'}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing && <SlotForm slot={editing.id ? editing : null} categories={data.categories} placeId={data.place.id}
        onClose={() => setEditing(null)} onSaved={finished} />}
      {removing && <RemoveSlot slot={removing} onClose={() => setRemoving(null)} onRemoved={finished} />}
    </div>
  );
}

function SlotForm({ slot, categories, placeId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    label: slot?.label?.replace(/\s+/g, ' ') || '',
    labelKn: slot?.labelKn || '',
    startsAt: slot?.startsAt || '',
    endsAt: slot?.endsAt || '',
    validFrom: slot?.validFrom || '',
    validTo: slot?.validTo || '',
    active: slot ? slot.active : true,
    capacities: Object.fromEntries(categories.map((c) => [c.code, String(slot?.capacities?.[c.code] ?? '')])),
  }));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const hoursLocked = slot && slot.upcoming > 0;

  async function save() {
    const body = { ...form, placeId, reason, capacities: Object.fromEntries(Object.entries(form.capacities).map(([k, v]) => [k, v === '' ? 0 : Number(v)])) };
    const out = await run(() => (slot ? api.updateSlot(slot.id, body) : api.createSlot(body)));
    if (out) onSaved(slot ? `“${out.slot.label}” updated.` : `“${out.slot.label}” added.`, out.oversold);
  }

  return (
    <Modal title={slot ? 'Edit slot' : 'Add a slot'} subtitle="Capacity applies to every open date from today" onClose={onClose} busy={busy} wide
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !reasonOk(reason) || !form.label || !form.startsAt || !form.endsAt}>
          {busy ? 'Saving…' : slot ? 'Save changes' : 'Add slot'}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={form.label} onChange={set('label')} placeholder="Evening 3:00 PM - 6:00 PM" /></Field>
        <Field label="Name in Kannada" hint="Shown to visitors who chose Kannada"><input className="input" value={form.labelKn} onChange={set('labelKn')} /></Field>
        <Field label="Starts at" hint={hoursLocked ? 'Locked: passes are booked in this slot' : undefined}>
          <input type="time" className="input" value={form.startsAt} onChange={set('startsAt')} disabled={hoursLocked} />
        </Field>
        <Field label="Ends at" hint={form.endsAt ? `Last entry ${to12(lastEntry(form.endsAt))}` : 'At least 90 minutes after the start'}>
          <input type="time" className="input" value={form.endsAt} onChange={set('endsAt')} disabled={hoursLocked} />
        </Field>
        <Field label="Opening date" hint="Leave empty to open it now">
          <input type="date" className="input" value={form.validFrom} onChange={set('validFrom')} />
        </Field>
        <Field label="Closing date" hint="Leave empty for no end">
          <input type="date" className="input" value={form.validTo} min={form.validFrom || undefined} onChange={set('validTo')} />
        </Field>
      </div>

      <div>
        <span className="label">Places per day, by vehicle type</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <label key={c.code} className="block rounded-lg border border-line p-3">
              <span className="text-2xs text-muted"><span aria-hidden>{ICON[c.code]}</span> {c.label}</span>
              <input type="number" min="0" step="1" inputMode="numeric" className="input mt-1 !py-1.5 tabular"
                value={form.capacities[c.code]} aria-label={`${c.label} capacity`}
                onChange={(e) => setForm((f) => ({ ...f, capacities: { ...f.capacities, [c.code]: e.target.value } }))} />
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={form.active} onChange={set('active')} className="h-4 w-4 accent-brand" />
        Open for booking
      </label>

      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function RemoveSlot({ slot, onClose, onRemoved }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();

  if (!slot.deletable) {
    return (
      <Modal title="This slot cannot be deleted" onClose={onClose}
        footer={<button type="button" className="btn-primary" onClick={onClose}>Understood</button>}>
        <p className="text-sm text-body">
          “{slot.label.replace(/\s+/g, ' ')}” has {number(slot.ticketsEver)} passes on record. They must stay traceable to the slot they were sold for.
        </p>
        <p className="text-sm text-body">To stop selling it, edit the slot and either untick <b>Open for booking</b> or give it a <b>closing date</b>.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Delete slot" subtitle={slot.label.replace(/\s+/g, ' ')} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn bg-wrong-500 text-white hover:bg-wrong-700" disabled={busy || !reasonOk(reason)}
          onClick={async () => { if (await run(() => api.deleteSlot(slot.id, reason))) onRemoved('Slot deleted.'); }}>
          {busy ? 'Deleting…' : 'Delete slot'}
        </button>
      </>}>
      <p className="text-sm text-body">No pass has ever been sold in this slot, so it can be removed completely.</p>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
