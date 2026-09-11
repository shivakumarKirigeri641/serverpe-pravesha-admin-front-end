import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { useSession, can } from '../lib/session';
import { dayLabel, number, rupees } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Destinations — every entry location Pravesha runs.
 *
 * A destination cannot be opened for booking until it can actually take a
 * visitor: a price for every vehicle type, a slot, places in it, and a
 * checkpost. The checklist is on every card, so what is left to do is never a
 * guess, and the API refuses to open one that is not ready.
 *
 * Prices, slots and staff have their own screens; this one links to them.
 */

const IMG_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export default function Destinations() {
  const { id } = useParams();
  const navigate = useNavigate();
  return id ? <Detail id={id} onBack={() => navigate('/destinations')} /> : <List onOpen={(d) => navigate(`/destinations/${d.id}`)} />;
}

/* ───────────────────────────────────────────────────────────── list ── */

function List({ onOpen }) {
  const { me } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => api.destinations().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const canManage = can(me, 'destinations.manage');

  return (
    <Shell title="Destinations — Manage Entry Locations"
      subtitle={data ? `${number(data.destinations.filter((d) => d.active).length)} open · ${number(data.destinations.length)} in all` : 'Tourist destinations and entry points connected to Pravesha'}
      actions={canManage && <button type="button" className="btn-primary !py-1.5 text-2xs" onClick={() => setAdding(true)}>Add destination</button>}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data && !error && <Loading rows={3} />}

      {data && (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.destinations.map((d) => (
            <article key={d.id} className={`card overflow-hidden ${d.active ? '' : 'opacity-90'}`}>
              <div className="flex gap-4 p-5">
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-shell">
                  {d.images[0]
                    ? <img src={`${IMG_BASE}/public/img/${d.images[0]}.webp?w=480`} alt="" className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center text-2xs text-muted">No photo</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="text-base font-semibold text-ink hover:underline" onClick={() => onOpen(d)}>{d.name}</button>
                    {d.active ? <span className="chip bg-good-50 text-good-700">Open for booking</span> : <span className="chip bg-shell text-muted">Not open</span>}
                    {d.closedDays > 0 && <span className="chip bg-wrong-50 text-wrong-700">{number(d.closedDays)} day{d.closedDays === 1 ? '' : 's'} closed</span>}
                  </div>
                  <p className="mt-0.5 text-2xs text-muted">{d.district} · {d.code}</p>
                  <p className="mt-1.5 line-clamp-2 text-sm text-body">{d.description || 'No description yet.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
                {[['Slots', number(d.slots)], ['Places a day', number(d.dailyCapacity)],
                  ['Passes (30 days)', number(d.last30Days.passes)], ['Value (30 days)', rupees(d.last30Days.value)]].map(([k, v]) => (
                    <div key={k} className="bg-white px-4 py-2.5">
                      <div className="text-2xs text-muted">{k}</div>
                      <div className="tabular text-sm font-semibold text-ink">{v}</div>
                    </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                {d.readiness.ready ? (
                  <p className="text-2xs text-good-700">Ready: prices, slots, places and a checkpost are all in place.</p>
                ) : (
                  <p className="text-2xs text-watch-700">Still needed: {d.readiness.missing.join('; ').toLowerCase()}.</p>
                )}
                <button type="button" className="btn-quiet !px-3 !py-1.5 text-2xs" onClick={() => onOpen(d)}>Open</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {adding && <DestinationForm onClose={() => setAdding(false)} onSaved={(out) => { setAdding(false); setNotice(`${out.destination.name} added. Set its prices, slots and a checkpost, then open it for booking.`); load(); }} />}
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────── detail ── */

function Detail({ id, onBack }) {
  const { me } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => api.destination(id).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const canManage = can(me, 'destinations.manage');
  const d = data?.destination;

  return (
    <Shell title={d ? d.name : 'Destination'} subtitle={d ? `${d.district} · ${d.code}` : ''}
      actions={<button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={onBack}>All destinations</button>}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data && !error && <Loading rows={4} />}

      {data && (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {d.active ? <span className="chip bg-good-50 text-good-700">Open for booking</span> : <span className="chip bg-shell text-muted">Not open</span>}
                <span className="text-2xs text-muted">Bookings up to {number(d.bookingDaysAhead)} days ahead · {number(d.upcoming)} upcoming passes</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-body">{d.description || 'No description yet.'}</p>
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-quiet" onClick={() => setDialog('edit')}>Edit details</button>
                <button type="button" className={d.active ? 'btn-quiet text-wrong-700' : 'btn-primary'}
                  onClick={() => setDialog(d.active ? 'close' : 'open')}>{d.active ? 'Close for booking' : 'Open for booking'}</button>
              </div>
            )}
          </div>

          {!d.readiness.ready && (
            <Banner tone="watch">
              <div className="font-medium">Not ready to open</div>
              <ul className="mt-1 space-y-0.5 text-2xs">
                {d.readiness.checks.map((c) => (
                  <li key={c.key}>
                    {c.done ? '✓' : '○'} {c.label}
                    {!c.done && <button type="button" className="ml-2 font-semibold underline" onClick={() => navigate(c.where)}>set it up</button>}
                  </li>
                ))}
              </ul>
            </Banner>
          )}

          {d.images.length > 0 && (
            <div className="flex gap-3 overflow-x-auto">
              {d.images.map((img) => (
                <img key={img} src={`${IMG_BASE}/public/img/${img}.webp?w=768`} alt="" className="h-40 w-64 shrink-0 rounded-xl object-cover" />
              ))}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Prices" link={can(me, 'settings.pricing') ? ['Change prices', '/settings/pricing'] : null} navigate={navigate}>
              <table className="w-full">
                <tbody className="divide-y divide-line">
                  {data.prices.map((p) => (
                    <tr key={p.code}>
                      <td className="td text-sm text-ink">{p.label}</td>
                      <td className="td tabular text-right text-sm">{p.entry === null ? <span className="text-wrong-700">not set</span> : `${rupees(p.entry)} + ${rupees(p.serviceFee)}`}</td>
                      <td className="td tabular text-right text-sm font-semibold text-ink">{p.total === null ? '—' : rupees(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Slots and capacity" link={can(me, 'settings.slots') ? ['Change slots', '/settings/slots'] : null} navigate={navigate}>
              {data.slots.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No slots yet.</p> : (
                <ul className="divide-y divide-line">
                  {data.slots.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div>
                        <div className="text-sm text-ink">{s.label}</div>
                        <div className="text-2xs text-muted">{s.startsAt}–{s.endsAt}{s.validFrom || s.validTo ? ` · ${s.validFrom || 'now'} → ${s.validTo || 'no end'}` : ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="tabular text-sm font-semibold text-ink">{number(s.capacity)}</div>
                        <div className="text-2xs text-muted">{s.active ? 'places' : 'inactive'}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Checkposts and staff" link={can(me, 'destinations.view') ? ['Checkposts', '/checkposts'] : null} navigate={navigate}>
              {data.checkposts.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No checkpost yet — passes cannot be checked.</p> : (
                <ul className="divide-y divide-line">
                  {data.checkposts.map((c) => (
                    <li key={c.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-ink">{c.name}</span>
                        {c.onDuty > 0 ? <span className="chip bg-good-50 text-good-700">{number(c.onDuty)} on duty</span> : <span className="chip bg-shell text-muted">Nobody signed in</span>}
                      </div>
                      <div className="text-2xs text-muted">{number(c.staff)} staff posted · {number(c.checksToday)} checks today</div>
                    </li>
                  ))}
                </ul>
              )}
              {data.staff.length > 0 && (
                <p className="border-t border-line px-4 py-2.5 text-2xs text-muted">
                  Staff: {data.staff.filter((s) => s.active).map((s) => s.name).join(', ') || 'none active'}
                </p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink">Last 30 days</h3>
              <p className="text-2xs text-muted">{number(d.last30Days.passes)} passes · {number(d.last30Days.entries)} entered · {rupees(d.last30Days.value)}</p>
              <div className="mt-3 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e4eaea" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(x) => x.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <Tooltip labelFormatter={dayLabel} contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', fontSize: 13 }} />
                    <Area type="monotone" dataKey="booked" name="Booked" stroke="#00a884" fill="#00a88422" strokeWidth={2} />
                    <Area type="monotone" dataKey="entered" name="Entered" stroke="#075e54" fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-ink">Rules shown to visitors</h3>
                {d.rules.length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
                  <ul className="mt-2 space-y-1.5">
                    {d.rules.map((r, i) => <li key={i} className="flex gap-2 text-sm text-body"><span className="text-muted">{i + 1}.</span>{r}</li>)}
                  </ul>
                )}
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-ink">Where it is</h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {[['Address', d.address], ['How to reach', d.howToReach], ['Contact', d.contactNumber],
                    ['Co-ordinates', d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : null]].map(([k, v]) => (
                      <div key={k}><dt className="text-2xs text-muted">{k}</dt><dd className="text-body">{v || '—'}</dd></div>
                  ))}
                </dl>
              </div>
              {data.closures.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-ink">Closed days ahead</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {data.closures.map((c) => <li key={c.date} className="text-body">{dayLabel(c.date)} — {c.title || c.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {dialog === 'edit' && (
        <DestinationForm destination={d} onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setNotice('Saved.'); load(); }} />
      )}
      {(dialog === 'open' || dialog === 'close') && (
        <StatusDialog destination={d} open={dialog === 'open'} onClose={() => setDialog(null)}
          onDone={(out) => {
            setDialog(null);
            setNotice(dialog === 'open' ? `${d.name} is open for booking.`
              : `${d.name} is closed for new bookings.${out.upcoming ? ` ${number(out.upcoming)} passes already sold stay valid.` : ''}`);
            load();
          }} />
      )}
    </Shell>
  );
}

const Card = ({ title, link, navigate, children }) => (
  <div className="card overflow-hidden">
    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
      <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {link && <button type="button" className="text-2xs font-semibold text-brand hover:underline" onClick={() => navigate(link[1])}>{link[0]}</button>}
    </div>
    {children}
  </div>
);

/* ───────────────────────────────────────────────────────────── forms ── */

function DestinationForm({ destination, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: destination?.name || '', nameKn: destination?.nameKn || '', code: destination?.code || '',
    district: destination?.district || '', districtKn: destination?.districtKn || '',
    description: destination?.description || '', descriptionKn: destination?.descriptionKn || '',
    address: destination?.address || '', howToReach: destination?.howToReach || '', contactNumber: destination?.contactNumber || '',
    latitude: destination?.latitude ?? '', longitude: destination?.longitude ?? '',
    bookingDaysAhead: destination?.bookingDaysAhead || 14,
    rules: (destination?.rules || []).join('\n'), images: destination?.images || [],
  }));
  const [library, setLibrary] = useState([]);
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => { api.destinationImages().then((d) => setLibrary(d.images)).catch(() => {}); }, []);

  const toggleImage = (name) => setF((x) => ({
    ...x, images: x.images.includes(name) ? x.images.filter((i) => i !== name) : [...x.images, name].slice(0, 8),
  }));

  async function save() {
    const body = {
      ...f, reason,
      rules: f.rules.split('\n').map((r) => r.trim()).filter(Boolean),
      bookingDaysAhead: Number(f.bookingDaysAhead),
      latitude: f.latitude === '' ? null : Number(f.latitude),
      longitude: f.longitude === '' ? null : Number(f.longitude),
    };
    const out = await run(() => (destination ? api.updateDestination(destination.id, body) : api.addDestination(body)));
    if (out) onSaved(out);
  }

  return (
    <Modal title={destination ? `Edit ${destination.name}` : 'Add a destination'} onClose={onClose} busy={busy} wide
      subtitle={destination ? undefined : 'It is added closed; open it once prices, slots and a checkpost are set up'}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || f.name.trim().length < 3 || f.district.trim().length < 3 || !reasonOk(reason)}>
          {busy ? 'Saving…' : destination ? 'Save changes' : 'Add destination'}
        </button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={f.name} onChange={set('name')} /></Field>
        <Field label="Name in Kannada"><input className="input" value={f.nameKn} onChange={set('nameKn')} /></Field>
        <Field label="District"><input className="input" value={f.district} onChange={set('district')} /></Field>
        <Field label="District in Kannada"><input className="input" value={f.districtKn} onChange={set('districtKn')} /></Field>
        {!destination && <Field label="Code" hint="Used in booking references. Letters and digits, no spaces."><input className="input font-mono uppercase" value={f.code} onChange={set('code')} placeholder="KUDREMUKHA" /></Field>}
        <Field label="Bookings open how many days ahead"><input type="number" min="1" max="90" className="input tabular" value={f.bookingDaysAhead} onChange={set('bookingDaysAhead')} /></Field>
        <Field label="Description" className="sm:col-span-2" hint="Shown to visitors on the website">
          <textarea className="input min-h-[80px]" value={f.description} maxLength={2000} onChange={set('description')} />
        </Field>
        <Field label="Description in Kannada" className="sm:col-span-2">
          <textarea className="input min-h-[60px]" value={f.descriptionKn} maxLength={2000} onChange={set('descriptionKn')} />
        </Field>
        <Field label="Rules" className="sm:col-span-2" hint="One per line — visitors see these before booking">
          <textarea className="input min-h-[100px]" value={f.rules} onChange={set('rules')} />
        </Field>
        <Field label="Address"><input className="input" value={f.address} onChange={set('address')} /></Field>
        <Field label="Contact number"><input className="input" value={f.contactNumber} onChange={set('contactNumber')} /></Field>
        <Field label="How to reach" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={f.howToReach} onChange={set('howToReach')} /></Field>
        <Field label="Latitude"><input className="input tabular" value={f.latitude} onChange={set('latitude')} placeholder="13.3916" /></Field>
        <Field label="Longitude"><input className="input tabular" value={f.longitude} onChange={set('longitude')} placeholder="75.7208" /></Field>
      </div>

      <div>
        <span className="label">Photographs</span>
        {library.length === 0 ? <p className="text-2xs text-muted">No photographs on the server yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {library.map((img) => (
              <button key={img.name} type="button" onClick={() => toggleImage(img.name)}
                className={`overflow-hidden rounded-lg border-2 ${f.images.includes(img.name) ? 'border-brand' : 'border-transparent opacity-70'}`}>
                <img src={`${IMG_BASE}${img.webp}?w=480`} alt={img.name} className="h-16 w-24 object-cover" />
              </button>
            ))}
          </div>
        )}
        <p className="mt-1 text-2xs text-muted">Photographs are the ones on the server; the first one is used as the cover.</p>
      </div>

      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function StatusDialog({ destination, open, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title={open ? `Open ${destination.name} for booking` : `Close ${destination.name} for booking`} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={open ? 'btn-primary' : 'btn bg-wrong-500 text-white hover:bg-wrong-700'} disabled={busy || !reasonOk(reason)}
          onClick={async () => { const out = await run(() => api.setDestinationActive(destination.id, open, reason)); if (out) onDone(out); }}>
          {busy ? 'Saving…' : open ? 'Open for booking' : 'Close for booking'}
        </button>
      </>}>
      <p className="text-sm text-body">
        {open
          ? 'Visitors will be able to book it on WhatsApp straight away.'
          : `New bookings stop. ${destination.upcoming ? `${number(destination.upcoming)} passes already sold stay valid and will still work at the gate.` : 'No passes are sold for future dates.'} To stop passes working for particular days, publish a closure under Notifications.`}
      </p>
      <Reason value={reason} onChange={setReason} />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
