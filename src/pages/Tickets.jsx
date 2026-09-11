import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { deliver } from '../lib/files';
import { useSession, can } from '../lib/session';
import { dayLabel, number, plate, rupees } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Ticket Management — find any pass and see all of it.
 *
 * The state shown is the one people ask about — booked, upcoming, yet to
 * arrive, entered, skipped, cancelled, expired, refunded — not the raw status
 * in the database. A pass cannot be edited: what the visitor bought is what the
 * gate must see. It can be cancelled, which returns its place, and it can be
 * sent to them again.
 */

const TONES = {
  booked: 'bg-watch-50 text-watch-700',
  upcoming: 'bg-brand/10 text-brand',
  yet_to_arrive: 'bg-brand/10 text-brand',
  entered: 'bg-good-50 text-good-700',
  skipped: 'bg-watch-50 text-watch-700',
  cancelled: 'bg-shell text-muted',
  expired: 'bg-shell text-muted',
  refunded: 'bg-wrong-50 text-wrong-700',
};

export default function Tickets() {
  const { id } = useParams();
  const navigate = useNavigate();
  return id ? <TicketDetail id={id} onBack={() => navigate('/tickets')} /> : <TicketSearch onOpen={(t) => navigate(`/tickets/${t.ticketNo}`)} />;
}

/* ─────────────────────────────────────────────────────────── search ── */

function TicketSearch({ onOpen }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [state, setState] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const size = 25;

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  const key = JSON.stringify([term, state, range, page]);

  useEffect(() => {
    let alive = true;
    api.ticketSearch({ q: term, state, from: range.from, to: range.to, limit: size, offset: page * size })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const states = data?.states || [];

  return (
    <Shell title="Ticket Management — Search & Control"
      subtitle={data ? `${number(data.total)} pass${data.total === 1 ? '' : 'es'} match` : 'Search, inspect and manage every pass'}>
      <div className="card mb-4 grid gap-3 p-4 xl:grid-cols-[2fr_1fr_auto_auto_auto]">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder="Pass number, mobile, vehicle number, visitor, booking reference, payment or invoice number" />
        <select className="input" value={state} onChange={(e) => { setState(e.target.value); setPage(0); }} aria-label="Status">
          <option value="">Any status</option>
          {states.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input type="date" className="input" value={range.from} aria-label="Visits from"
          onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPage(0); }} />
        <input type="date" className="input" value={range.to} min={range.from || undefined} aria-label="Visits to"
          onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPage(0); }} />
        <button type="button" className="btn-quiet" disabled={!q && !state && !range.from && !range.to}
          onClick={() => { setQ(''); setState(''); setRange({ from: '', to: '' }); setPage(0); }}>Clear</button>
      </div>

      {states.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {states.map((s) => (
            <button key={s.key} type="button" title={s.hint} onClick={() => { setState(state === s.key ? '' : s.key); setPage(0); }}
              className={`chip border ${state === s.key ? 'border-brand bg-brand text-white' : `border-transparent ${TONES[s.key] || 'bg-shell text-muted'}`}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {error && <Banner tone="wrong" className="mb-3">{error}</Banner>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1040px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Pass</th><th className="th">Visitor</th><th className="th">Vehicle</th><th className="th">Destination</th>
              <th className="th">Visit</th><th className="th text-right">Amount</th><th className="th">Status</th><th className="th">Entry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!data && <tr><td colSpan={8} className="h-24 animate-pulse" /></tr>}
            {data?.tickets.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No pass matches. Try the pass number, the vehicle number or the last four digits of the mobile.</td></tr>}
            {data?.tickets.map((t) => {
              const label = states.find((s) => s.key === t.state)?.label || t.state;
              return (
                <tr key={t.id} className="cursor-pointer hover:bg-shell/50" onClick={() => onOpen(t)}>
                  <td className="td">
                    <div className="font-mono text-sm font-semibold text-ink">{t.ticketNo}</div>
                    <div className="text-2xs text-muted">{t.issuedAs === 'free' ? 'Free pass' : t.issuedAs === 'onspot' ? 'On-spot' : `booked ${when(t.bookedAt)}`}</div>
                  </td>
                  <td className="td"><div className="text-sm text-ink">{t.visitor || '—'}</div><div className="text-2xs text-muted">{t.mobile}</div></td>
                  <td className="td"><div className="font-mono text-sm">{plate(t.regNo)}</div><div className="text-2xs text-muted">{t.vehicleType}</div></td>
                  <td className="td text-sm">{t.place}</td>
                  <td className="td"><div className="whitespace-nowrap text-sm text-ink">{dayLabel(t.travelDate)}</div><div className="text-2xs text-muted">{t.slot}</div></td>
                  <td className="td tabular text-right text-ink">{t.amount === 0 ? 'Free' : rupees(t.amount)}</td>
                  <td className="td">
                    <span className={`chip ${TONES[t.state] || 'bg-shell text-muted'}`}>{label}</span>
                    {t.partlyRefunded && <div className="mt-1 text-2xs text-watch-700">partly refunded</div>}
                  </td>
                  <td className="td text-2xs text-muted">{t.enteredAt ? when(t.enteredAt) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">{number(page * size + 1)}–{number(Math.min(data.total, (page + 1) * size))} of {number(data.total)}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-quiet !py-1.5" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>Newer</button>
              <span className="text-2xs text-muted">Page {page + 1} of {number(pages)}</span>
              <button type="button" className="btn-quiet !py-1.5" disabled={page + 1 >= pages} onClick={() => setPage((x) => x + 1)}>Older</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────── detail ── */

function TicketDetail({ id, onBack }) {
  const { me } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setData(null);
    api.ticket(id).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function pass(action) {
    setBusy(action);
    try { deliver(await api.passFile(data.ticket.id), action); } catch (e) { setError(e.message); } finally { setBusy(null); }
  }

  const t = data?.ticket;

  return (
    <Shell title={t ? `Pass ${t.ticketNo}` : 'Pass'} subtitle={t ? `${t.place} · ${dayLabel(t.travelDate)} · ${t.slot}` : ''}
      actions={<button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={onBack}>Back to search</button>}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data && !error && <Loading rows={4} />}

      {data && (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="font-mono text-2xl font-bold tracking-wide text-ink">{t.ticketNo}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`chip ${TONES[t.state] || 'bg-shell text-muted'}`}>{t.stateLabel}</span>
                {t.issuedAs !== 'whatsapp' && <span className="chip bg-watch-50 text-watch-700">{t.issuedAs === 'free' ? 'Free pass' : 'On-spot sale'}</span>}
                {data.visitor.blocked && <span className="chip bg-wrong-50 text-wrong-700">Visitor blocked</span>}
                <span className="text-2xs text-muted">booked {when(t.bookedAt)} · {t.reference}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-quiet" disabled={busy} onClick={() => pass('open')}>{busy === 'open' ? '…' : 'View pass'}</button>
              <button type="button" className="btn-quiet" disabled={busy} onClick={() => pass('save')}>{busy === 'save' ? '…' : 'Download'}</button>
              {can(me, 'tickets.resend') && data.payment.paidAt && (
                <button type="button" className="btn-quiet" onClick={() => setDialog('resend')}>Send again</button>
              )}
              {can(me, 'tickets.cancel') && t.cancellable && (
                <button type="button" className="btn-quiet text-wrong-700" onClick={() => setDialog('cancel')}>Cancel pass</button>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Visitor" rows={[
              ['Name', data.visitor.name || '—'],
              ['WhatsApp number', data.visitor.mobile],
              ['Language', data.visitor.language === 'kn' ? 'Kannada' : 'English'],
            ]} />
            <Panel title="Vehicle" rows={[
              ['Number', plate(data.vehicle.regNo)],
              ['Type', data.vehicle.type],
              ['Make and model', [data.vehicle.maker, data.vehicle.model].filter(Boolean).join(' ') || '—'],
              ['Fuel · colour', [data.vehicle.fuel, data.vehicle.colour].filter(Boolean).join(' · ') || '—'],
              ['Class', data.vehicle.vehicleClass || '—'],
            ]} />
            <Panel title="Visit" rows={[
              ['Destination', `${t.place}${data.ticket.district ? `, ${data.ticket.district}` : ''}`],
              ['Date', dayLabel(t.travelDate)],
              ['Slot', t.slot],
              ['Last entry', t.lastEntry],
              ['Pass status', t.stateLabel],
            ]} />
            <Panel title="Payment" rows={[
              ['Amount', data.payment.amount === 0 ? 'Free pass' : rupees(data.payment.amount)],
              ['Entry fee (Department)', rupees(data.payment.entry)],
              ['Service fee (Pravesha)', rupees(data.payment.fee)],
              ['GST within the fee', rupees(data.payment.gst)],
              ['Paid', data.payment.paidAt ? when(data.payment.paidAt) : '—'],
              ['Method', data.payment.method || '—'],
              ['Payment ID', data.payment.paymentId || data.payment.reference || '—'],
              ['Invoice', data.payment.invoiceNo || '—'],
              ...(data.payment.refunded > 0 ? [['Refunded', `${rupees(data.payment.refunded)} · ${data.payment.refundReason || ''}`]] : []),
            ]} />
            <Panel title="Entry" rows={[
              ['Entry status', data.entry.status],
              ['Entered at', data.entry.at ? when(data.entry.at) : '—'],
              ['Checkpost', data.entry.checkpost || '—'],
              ['Checked by', data.entry.staff || '—'],
              ['Attempts at the gate', number(data.entry.attempts.length)],
            ]} />
            {data.grant ? (
              <Panel title={data.grant.kind === 'free' ? 'Free pass' : 'On-spot sale'} rows={[
                ['Reason', data.grant.reasonCode || '—'],
                ['Explanation', data.grant.reason || '—'],
                ['Approved by', data.grant.approvedBy || '—'],
                ['Issued by', data.grant.issuedBy || '—'],
                ['Issued', when(data.grant.at)],
              ]} />
            ) : (
              <Panel title="Booking" rows={[
                ['Booked on', when(t.bookedAt)],
                ['Reference', t.reference],
                ['Issued through', 'WhatsApp'],
              ]} />
            )}
          </div>

          <section>
            <h2 className="mb-2 text-[15px] font-semibold text-ink">History</h2>
            <div className="card p-5">
              <ol className="space-y-3 border-l border-line pl-4">
                {data.timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-accent" />
                    <div className="text-sm text-ink">{e.what}</div>
                    <div className="text-2xs text-muted">{when(e.at)}{e.detail ? ` · ${e.detail}` : ''}</div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      )}

      {dialog === 'cancel' && (
        <CancelDialog ticket={t} onClose={() => setDialog(null)}
          onDone={(out) => {
            setDialog(null);
            setNotice(out.cancelled.refundNeeded
              ? 'Pass cancelled and its place returned to the slot. The money has not been refunded — make the refund in Razorpay if one is due.'
              : 'Pass cancelled and its place returned to the slot.');
            load();
          }} />
      )}
      {dialog === 'resend' && (
        <ResendDialog ticket={t} mobile={data.visitor.mobile} onClose={() => setDialog(null)}
          onDone={(out) => { setDialog(null); setNotice(out.message); load(); }} />
      )}
    </Shell>
  );
}

const Panel = ({ title, rows }) => (
  <div className="card">
    <div className="border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted">{title}</div>
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  </div>
);

function CancelDialog({ ticket, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Cancel this pass" subtitle={ticket.ticketNo} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Keep the pass</button>
        <button type="button" className="btn bg-wrong-500 text-white hover:bg-wrong-700" disabled={busy || !reasonOk(reason)}
          onClick={async () => { const out = await run(() => api.cancelTicket(ticket.id, reason)); if (out) onDone(out); }}>
          {busy ? 'Cancelling…' : 'Cancel pass'}
        </button>
      </>}>
      <p className="text-sm text-body">
        The pass stops working at the gate and its place goes back to the slot for someone else. The visitor is not messaged, and no money moves — a refund, if one is due, is made in Razorpay.
      </p>
      <Reason value={reason} onChange={setReason} placeholder="e.g. Visitor called: booked the wrong date, rebooking for Sunday" />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}

function ResendDialog({ ticket, mobile, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Send the pass again" subtitle={`${ticket.ticketNo} → ${mobile}`} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy}
          onClick={async () => { const out = await run(() => api.resendTicket(ticket.id, reason)); if (out) onDone(out); }}>
          {busy ? 'Sending…' : 'Send on WhatsApp'}
        </button>
      </>}>
      <p className="text-sm text-body">
        The message and the pass PDF go to the number on the pass and nowhere else.
      </p>
      <Field label="Note (optional)" hint="Recorded in the audit log with your name">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Visitor deleted the message" />
      </Field>
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
