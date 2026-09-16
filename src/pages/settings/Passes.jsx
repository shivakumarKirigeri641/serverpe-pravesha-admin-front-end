import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useSession, can } from '../../lib/session';
import { dayLabel, number, plate, rupees, shiftDay } from '../../lib/format';
import { Banner, Field, Loading, useAction, when } from '../../components/ui.jsx';

const ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

/*
 * Passes issued from the panel.
 *
 * FREE — for someone who must not pay: an official on duty, rescue services, a
 * complaint put right. Always a reason from the list, a written explanation and
 * an approving officer; all three are recorded against the person issuing it.
 *
 * ON-SPOT — for a visitor at the gate without a booking: today only, in a slot
 * still open, paid at the counter by cash, UPI or card.
 *
 * Both are ordinary passes in every other way: the vehicle type comes from the
 * registration, the place comes out of the slot's capacity, and one vehicle
 * still gets one pass a day. No WhatsApp message is sent.
 */
export default function Passes() {
  const { me } = useSession();
  const kinds = [can(me, 'tickets.free') && 'free', can(me, 'tickets.onspot') && 'onspot'].filter(Boolean);
  const [kind, setKind] = useState(kinds[0]);
  const [date, setDate] = useState(null);
  const [avail, setAvail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [issued, setIssued] = useState(null);
  const [grants, setGrants] = useState([]);

  const loadAvail = useCallback((d) => api.ticketAvailability(d).then((a) => { setAvail(a); setLoadError(null); }).catch((e) => setLoadError(e.message)), []);
  const loadGrants = useCallback(() => api.ticketGrants().then((g) => setGrants(g.grants)).catch(() => {}), []);

  useEffect(() => { loadAvail(kind === 'onspot' ? null : date); }, [kind, date, loadAvail]);
  useEffect(() => { loadGrants(); }, [loadGrants]);

  if (loadError) return <Banner tone="wrong">{loadError}</Banner>;
  if (!avail) return <Loading />;

  return (
    <div className="space-y-6">
      {kinds.length > 1 && (
        <div className="inline-flex gap-1 rounded-lg border border-line bg-white p-1">
          {[['free', 'Free pass'], ['onspot', 'On-spot pass']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setKind(k); setIssued(null); }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${kind === k ? 'bg-brand text-white' : 'text-body hover:bg-shell'}`}>{label}</button>
          ))}
        </div>
      )}

      {issued && <Issued ticket={issued} onAnother={() => setIssued(null)} />}

      {!issued && (kind !== 'onspot' || avail.date === avail.today) && (
        <PassForm key={kind} kind={kind} avail={avail} date={date || avail.date} onDate={setDate}
          onIssued={(t) => { setIssued(t); loadAvail(kind === 'onspot' ? null : date); loadGrants(); }} />
      )}

      <Register grants={grants} />
    </div>
  );
}

function PassForm({ kind, avail, date, onDate, onIssued }) {
  const free = kind === 'free';
  const [slotId, setSlotId] = useState('');
  const [regNo, setRegNo] = useState('');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [recordEntry, setRecordEntry] = useState(true);
  /* Off by default: a free pass is often for somebody who should not be messaged. */
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const { busy, error, run } = useAction();

  const slots = useMemo(() => avail.slots.filter((s) => s.isOpen && ((free && date > avail.today) || !s.timeClosed)), [avail, free, date]);
  useEffect(() => { if (!slots.find((s) => s.slotId === slotId)) setSlotId(slots[0]?.slotId || ''); }, [slots, slotId]);

  const plateOk = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$|^\d{2}BH\d{4}[A-Z]{1,2}$/.test(regNo);
  const ready = slotId && plateOk && /^\d{10}$/.test(mobile) && (free
    ? reasonCode && reason.trim().length >= 5 && approvedBy
    : method === 'cash' || reference.trim().length >= 4);

  async function issue() {
    const body = { placeId: avail.place.id, slotId, regNo, mobile, name };
    const out = await run(() => (free
      ? api.issueFree({ ...body, travelDate: date, reasonCode, reason, approvedBy, sendWhatsapp })
      : api.issueOnspot({ ...body, paymentMethod: method, paymentReference: reference, recordEntry })));
    if (out) onIssued({ ...out.ticket, kind, whatsapp: out.whatsapp || null });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">{free ? 'Issue a free pass' : 'Sell an on-spot pass'}</h2>
        <p className="mt-0.5 text-2xs text-muted">
          {free ? 'No payment is taken. The reason, explanation and approving officer are recorded against your name.'
            : 'For a visitor at the gate today. Collect the amount first, then issue.'}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {free ? (
            <Field label="Date of visit" hint="Today or up to 14 days ahead">
              <input type="date" className="input" value={date} min={avail.today} max={shiftDay(avail.today, 14)} onChange={(e) => onDate(e.target.value)} />
            </Field>
          ) : (
            <Field label="Date of visit" hint="On-spot passes are for today only">
              <input className="input bg-shell" value={dayLabel(avail.today)} disabled />
            </Field>
          )}
          <Field label="Vehicle number" hint={regNo && !plateOk ? 'Check the number, e.g. KA01AB1234' : 'The vehicle type is read from its registration'}>
            <input className="input font-mono uppercase tracking-wide" value={regNo} maxLength={12}
              onChange={(e) => setRegNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="KA01AB1234" />
          </Field>
          <Field label="Visitor mobile"><input className="input tabular" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10 digits" /></Field>
          <Field label="Visitor name" hint="Optional"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>

        <div className="mt-5">
          <span className="label">Slot</span>
          {slots.length === 0 ? (
            <Banner tone="watch">No slot can be entered {free && date > avail.today ? 'on that date' : 'any more today'}.</Banner>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <label key={s.slotId} className={`cursor-pointer rounded-lg border px-3 py-2.5 ${slotId === s.slotId ? 'border-brand bg-brand/5' : 'border-line'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="slot" className="h-4 w-4 accent-brand" checked={slotId === s.slotId} onChange={() => setSlotId(s.slotId)} />
                    <span className="text-sm font-semibold text-ink">{s.label}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-6 text-2xs text-muted">
                    {s.types.map((t) => <span key={t.code}>{ICON[t.code]} {number(t.remaining)} left</span>)}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {free ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Reason">
              <select className="input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                <option value="">Choose…</option>
                {avail.freeReasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Approving officer" hint="An active admin">
              <select className="input" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}>
                <option value="">Choose…</option>
                {avail.approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Explanation" className="sm:col-span-2" hint="Who, and why they should not pay. At least a few words.">
              <textarea className="input min-h-[72px]" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. RFO Chikkamagaluru range inspecting the approach road, order no. 42/2026" />
            </Field>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <span className="label">Payment received by</span>
              <div className="flex flex-wrap gap-2">
                {[['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card']].map(([k, label]) => (
                  <label key={k} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${method === k ? 'border-brand bg-brand/5 font-semibold text-ink' : 'border-line'}`}>
                    <input type="radio" name="method" className="sr-only" checked={method === k} onChange={() => setMethod(k)} />{label}
                  </label>
                ))}
              </div>
            </div>
            {method !== 'cash' && (
              <Field label={method === 'upi' ? 'UPI transaction reference' : 'Card slip reference'} hint="From the payment app or card machine">
                <input className="input font-mono" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value.trim())} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={recordEntry} onChange={(e) => setRecordEntry(e.target.checked)} />
              The vehicle is at the gate — record its entry now
            </label>
          </div>
        )}

        {free && (
          <label className="mt-4 flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} />
            <span>
              Send the pass details to this number on WhatsApp
              <span className="block text-2xs text-muted">Pass number, vehicle, place, date and slot, with a button that opens the pass.</span>
            </span>
          </label>
        )}

        {error && <Banner tone="wrong" className="mt-4">{error}</Banner>}
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-primary" onClick={issue} disabled={!ready || busy}>
            {busy ? 'Issuing…' : free ? 'Issue free pass' : 'Issue on-spot pass'}
          </button>
        </div>
      </section>

      <aside className="card h-max p-5">
        <h3 className="text-sm font-semibold text-ink">{free ? 'What a free pass costs' : 'What to collect'}</h3>
        <table className="mt-3 w-full">
          <tbody className="divide-y divide-line">
            {avail.prices.map((p) => (
              <tr key={p.code}>
                <td className="py-2 text-sm text-ink">{ICON[p.code]} {p.label}</td>
                <td className="py-2 text-right tabular text-sm">{free ? <span className="text-muted line-through">{rupees(p.total)}</span> : <b className="text-ink">{rupees(p.total)}</b>}</td>
                <td className="py-2 pl-2 text-right text-2xs text-muted">{free ? '₹0' : `${rupees(p.entry)} + ${rupees(p.serviceFee)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-2xs text-muted">
          The vehicle type — and so the price — is decided by the registration, exactly as for a WhatsApp booking. {free ? 'The pass is sent on WhatsApp only if you tick the box; otherwise show or note the pass number for the visitor.' : 'The pass is not sent on WhatsApp; show or note the pass number for the visitor.'}
        </p>
      </aside>
    </div>
  );
}

function Issued({ ticket, onAnother }) {
  return (
    <section className="card border-good-500/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="chip bg-good-50 text-good-700">{ticket.kind === 'free' ? 'Free pass issued' : ticket.status === 'used' ? 'On-spot pass issued · entry recorded' : 'On-spot pass issued'}</span>
          <div className="mt-2 font-mono text-3xl font-bold tracking-wider text-ink">{ticket.ticketNo}</div>
          <p className="mt-1 text-sm text-body">
            <span className="font-mono">{plate(ticket.regNo)}</span> · {ticket.vehicleType}{ticket.vehicle ? ` · ${ticket.vehicle}` : ''}
          </p>
          <p className="text-sm text-body">{dayLabel(ticket.travelDate)} · {ticket.slot} · {ticket.visitor || 'Visitor'} {ticket.mobile}</p>
          {ticket.whatsapp && (
            <Banner tone={ticket.whatsapp.sent ? 'good' : 'watch'} className="mt-3">{ticket.whatsapp.message}</Banner>
          )}
        </div>
        <div className="text-right">
          <div className="label">Amount</div>
          <div className="tabular text-2xl font-bold text-ink">{rupees(ticket.amount)}</div>
          <button type="button" className="btn-primary mt-3" onClick={onAnother}>Issue another</button>
        </div>
      </div>
    </section>
  );
}

function Register({ grants }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-ink">Recently issued from the panel</h3>
        <p className="text-2xs text-muted">Free and on-spot passes, newest first</p>
      </div>
      {grants.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">None yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-line bg-shell">
              <tr><th className="th">Issued</th><th className="th">Pass</th><th className="th">Vehicle</th><th className="th">Visit</th><th className="th">Type</th><th className="th">Details</th><th className="th">By</th><th className="th text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {grants.map((g) => (
                <tr key={g.ticketNo}>
                  <td className="td whitespace-nowrap text-2xs text-muted">{when(g.at)}</td>
                  <td className="td font-mono text-sm text-ink">{g.ticketNo}</td>
                  <td className="td font-mono text-sm">{plate(g.regNo)}</td>
                  <td className="td whitespace-nowrap text-sm">{dayLabel(g.travelDate)}</td>
                  <td className="td">{g.kind === 'free' ? <span className="chip bg-watch-50 text-watch-700">Free</span> : <span className="chip bg-brand/10 text-brand">On-spot</span>}</td>
                  <td className="td max-w-xs text-2xs text-body">
                    {g.kind === 'free' ? <><b className="text-ink">{g.reasonCode}</b> — {g.reason}{g.approvedBy ? ` · approved by ${g.approvedBy}` : ''}</>
                      : <>{String(g.paymentMethod || '').toUpperCase()}{g.paymentReference ? ` · ${g.paymentReference}` : ''}</>}
                  </td>
                  <td className="td text-sm">{g.issuedBy}</td>
                  <td className="td tabular text-right text-ink">{rupees(g.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
