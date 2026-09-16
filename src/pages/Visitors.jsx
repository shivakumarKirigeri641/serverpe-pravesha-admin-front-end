import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { usePulseTick } from '../lib/usePulse';
import { dayLabel, number, plate, rupees } from '../lib/format';
import { Banner, Loading, Plates, when } from '../components/ui.jsx';

/*
 * Visitors — one person's whole story, for handling a complaint.
 *
 * "I paid and the gate turned me away", "I was charged twice", "my pass never
 * came": each is answered from the same page. Every pass with what was paid and
 * refunded, payments that never became a pass, every look at their vehicles at a
 * barrier (refusals first in mind), what they said in feedback, and whether our
 * WhatsApp messages actually reached them.
 *
 * Found by what the caller can read out: the mobile number (whole, or the last
 * four digits), their name, or a number plate. The number stays masked.
 */

const STATUS = {
  used: ['Entered', 'bg-good-50 text-good-700'],
  paid: ['Not used yet', 'bg-shell text-muted'],
  cancelled: ['Cancelled', 'bg-wrong-50 text-wrong-700'],
  expired: ['Abandoned at payment', 'bg-shell text-muted'],
  held: ['Being paid for', 'bg-watch-50 text-watch-700'],
};

const VERDICTS = {
  valid: ['Entered', 'bg-good-50 text-good-700'],
  valid_override: ['Allowed outside slot', 'bg-watch-50 text-watch-700'],
  already_used: ['Refused — already used', 'bg-wrong-50 text-wrong-700'],
  wrong_day: ['Refused — wrong day', 'bg-wrong-50 text-wrong-700'],
  wrong_slot: ['Outside the slot', 'bg-watch-50 text-watch-700'],
  wrong_place: ['Refused — wrong place', 'bg-wrong-50 text-wrong-700'],
  not_paid: ['Refused — not paid', 'bg-wrong-50 text-wrong-700'],
  unknown_ticket: ['Refused — no pass found', 'bg-wrong-50 text-wrong-700'],
  cancelled: ['Refused — cancelled', 'bg-wrong-50 text-wrong-700'],
  watch_blocked: ['Refused — watchlist', 'bg-wrong-50 text-wrong-700'],
};

export default function Visitors() {
  const { id } = useParams();
  return id ? <OneVisitor id={id} /> : <Search />;
}

function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  /* A visitor's new booking or entry shows without a reload. */
  const tick = usePulseTick();
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setData(null); return undefined; }
    const tid = setTimeout(async () => {
      setBusy(true);
      try { setData(await api.visitors(term)); setError(null); } catch (e) { setError(e.message); } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(tid);
  }, [q, tick]);

  const rows = data?.visitors || [];

  return (
    <Shell title="Visitors" subtitle="Look a visitor up to handle a complaint">
      <div className="card mb-4 p-4">
        <input className="input text-base" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Mobile number (or its last 4 digits), name, or a number plate" />
        <p className="mt-2 text-2xs text-muted">Everything about the visitor on one page: passes, payments and refunds, gate checks, feedback and messages.</p>
      </div>

      {error && <Banner tone="wrong">{error}</Banner>}
      {busy && !data && <Loading rows={3} />}
      {data && rows.length === 0 && <div className="card px-5 py-10 text-center text-sm text-muted">No visitor matches that.</div>}

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-line bg-shell">
              <tr><th className="th">Visitor</th><th className="th">Mobile</th><th className="th">Vehicles</th><th className="th text-right">Passes</th><th className="th">Last visit</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => (
                <tr key={v.id} className="cursor-pointer hover:bg-shell" onClick={() => navigate(`/visitors/${v.id}`)}>
                  <td className="td">
                    <div className="font-medium text-ink">{v.name || 'No name given'}</div>
                    {v.blocked && <span className="chip bg-wrong-50 text-wrong-700">Blocked</span>}
                  </td>
                  <td className="td font-mono text-muted">{v.mobile}</td>
                  <td className="td font-mono text-2xs text-muted"><Plates list={v.plates} /></td>
                  <td className="td tabular text-right">{number(v.passes)}</td>
                  <td className="td text-muted">{v.lastVisit ? dayLabel(v.lastVisit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

function OneVisitor({ id }) {
  const navigate = useNavigate();
  const tick = usePulseTick();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.visitor(id).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [id, tick]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/visitors'));
  if (error) return <Shell title="Visitor" onBack={back}><Banner tone="wrong">{error}</Banner></Shell>;
  if (!data) return <Shell title="Visitor" onBack={back}><Loading /></Shell>;

  const v = data.visitor;
  const t = data.totals;
  const money = !data.moneyHidden;
  const refusals = data.checks.filter((c) => !['valid', 'valid_override'].includes(c.verdict));

  return (
    <Shell title={v.name || v.waName || 'Visitor'} subtitle={`${v.mobile} · ${v.language === 'kn' ? 'Kannada' : 'English'}${v.languageChosen ? '' : ' (not chosen)'}`}
      onBack={back} backLabel="Visitors">
      {v.blocked && <Banner tone="wrong">This number is blocked{v.blockedReason ? ` — ${v.blockedReason}` : ''}.</Banner>}
      {data.watchedPlates.length > 0 && (
        <Banner tone="warn">On the watchlist: {data.watchedPlates.map((w) => `${plate(w.regNo)} (${w.level === 'block' ? 'blocked' : 'check carefully'} — ${w.reason})`).join('; ')}</Banner>
      )}
      {data.strayPayments.length > 0 && (
        <Banner tone="wrong">
          {data.strayPayments.length} payment{data.strayPayments.length === 1 ? '' : 's'} with no pass attached — see "Payments without a pass" below.
        </Banner>
      )}
      {data.messages.failed > 0 && (
        <Banner tone="warn">{number(data.messages.failed)} WhatsApp message{data.messages.failed === 1 ? '' : 's'} to this visitor failed to send.</Banner>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Passes" value={number(t.passes)} note={`${number(t.notUsed)} not used yet`} />
        <Stat label="Entered" value={number(t.entries)} note={`${number(t.abandoned)} abandoned at payment`} />
        <Stat label="Refused at a gate" value={number(refusals.length)} tone={refusals.length ? 'text-wrong-700' : ''} />
        {money && <Stat label="Paid" value={rupees(t.paid)} note={t.refunded ? `${rupees(t.refunded)} refunded` : 'nothing refunded'} />}
        <Stat label="Messages" value={number(data.messages.total)} note={data.messages.lastAt ? `last ${when(data.messages.lastAt)}` : 'none'} />
      </div>

      <Section title="Passes">
        {data.passes.length === 0 ? <Empty>No passes.</Empty> : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-line bg-shell">
              <tr>
                <th className="th">Pass</th><th className="th">For</th><th className="th">Vehicle</th><th className="th">How</th>
                <th className="th">Status</th>{money && <th className="th text-right">Paid</th>}<th className="th">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.passes.map((p) => {
                const [label, tone] = STATUS[p.status] || [p.status, 'bg-shell text-muted'];
                return (
                  <tr key={p.id} className="align-top">
                    <td className="td">
                      <button type="button" className="font-mono text-brand hover:underline" onClick={() => navigate(`/tickets/${p.id}`)}>{p.ticketNo}</button>
                      {p.invoiceNo && <div className="text-2xs text-muted">{p.invoiceNo}</div>}
                    </td>
                    <td className="td">
                      <div>{dayLabel(p.travelDate)}</div>
                      <div className="text-2xs text-muted">{p.place} · {p.slot}</div>
                    </td>
                    <td className="td">
                      <button type="button" className="font-mono hover:underline" onClick={() => navigate(`/vehicles/${encodeURIComponent(p.regNo)}`)}>{plate(p.regNo)}</button>
                      <div className="text-2xs text-muted">{p.type}</div>
                      {p.watch && <span className="chip bg-watch-50 text-watch-700">Watchlist</span>}
                    </td>
                    <td className="td text-2xs text-muted">{p.how}<div>booked {when(p.bookedAt)}</div></td>
                    <td className="td">
                      <span className={`chip ${tone}`}>{label}</span>
                      {p.enteredAt && <div className="text-2xs text-muted">in {when(p.enteredAt)}{p.entrySource === 'self' ? ' · by the visitor' : ''}</div>}
                    </td>
                    {money && <td className="td tabular text-right">{rupees(p.amount)}{p.refunded ? <div className="text-2xs text-wrong-700">−{rupees(p.refunded)}</div> : null}</td>}
                    <td className="td text-2xs text-muted">
                      {p.paymentStatus || '—'}{p.paidAt ? ` · ${when(p.paidAt)}` : ''}
                      {p.refundReason && <div>Refund: {p.refundReason}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {data.strayPayments.length > 0 && (
        <Section title="Payments without a pass">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {data.strayPayments.map((p) => (
                <tr key={p.id}>
                  <td className="td font-mono text-2xs">{p.orderId || `payment ${p.id}`}</td>
                  <td className="td">{p.status}</td>
                  {money && <td className="td tabular text-right">{rupees(p.amount)}</td>}
                  <td className="td text-2xs text-muted">{when(p.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="At the gate">
          {data.checks.length === 0 ? <Empty>Never checked at a gate.</Empty> : (
            <ul className="divide-y divide-line">
              {data.checks.map((c) => {
                const [label, tone] = VERDICTS[c.verdict] || [c.verdict, 'bg-shell text-muted'];
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm text-ink">{when(c.at)}{c.offline ? ' · recorded offline' : ''}</div>
                      <div className="text-2xs text-muted">{plate(c.regNo)} · {c.ticketNo || 'no pass'} · {c.staff || 'visitor'}{c.checkpost ? ` · ${c.checkpost}` : ''}</div>
                    </div>
                    <span className={`chip shrink-0 ${tone}`}>{label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="space-y-5">
          <Section title="Feedback">
            {data.feedback.length === 0 ? <Empty>No feedback given.</Empty> : (
              <ul className="divide-y divide-line">
                {data.feedback.map((f) => (
                  <li key={f.id} className="px-4 py-2.5">
                    <div className="text-sm"><span className="text-watch-700">{'★'.repeat(f.rating)}{'☆'.repeat(Math.max(0, 5 - f.rating))}</span> <span className="text-2xs text-muted">{when(f.at)}{f.published ? ' · published' : ''}</span></div>
                    {f.comment && <p className="mt-0.5 text-sm text-body">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="WhatsApp messages">
            <div className="grid grid-cols-3 gap-px bg-line text-center">
              <Mini label="From visitor" value={number(data.messages.received)} />
              <Mini label="Sent to them" value={number(data.messages.sent)} />
              <Mini label="Failed" value={number(data.messages.failed)} tone={data.messages.failed ? 'text-wrong-700' : ''} />
            </div>
            {data.messages.failures.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {data.messages.failures.map((f, i) => (
                  <li key={i} className="px-4 py-2 text-2xs"><span className="text-ink">{f.what}</span> · {when(f.at)}<div className="text-wrong-700">{f.error}</div></li>
                ))}
              </ul>
            )}
            <p className="border-t border-line px-4 py-2 text-2xs text-muted">
              {data.messages.lastFromVisitorAt ? `They last wrote to us ${when(data.messages.lastFromVisitorAt)}.` : 'They have not written to us.'}
            </p>
          </Section>

          <Section title="About">
            <dl className="divide-y divide-line text-sm">
              <Row k="Visitor since" v={when(v.since)} />
              <Row k="Last seen" v={when(v.lastSeenAt)} />
              <Row k="Terms accepted" v={v.termsAccepted ? when(v.termsAccepted) : 'Not yet'} />
              <Row k="WhatsApp name" v={v.waName || '—'} />
            </dl>
          </Section>
        </div>
      </div>
    </Shell>
  );
}

const Section = ({ title, children }) => (
  <section className="card mb-5 overflow-x-auto">
    <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{title}</h3>
    {children}
  </section>
);
const Empty = ({ children }) => <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
const Stat = ({ label, value, note, tone = '' }) => (
  <div className="card p-4">
    <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
    <div className={`mt-1 tabular text-2xl font-bold ${tone || 'text-ink'}`}>{value}</div>
    {note && <div className="mt-1 text-2xs text-muted">{note}</div>}
  </div>
);
const Mini = ({ label, value, tone = '' }) => (
  <div className="bg-white px-3 py-2.5">
    <div className={`tabular text-lg font-bold ${tone || 'text-ink'}`}>{value}</div>
    <div className="text-2xs text-muted">{label}</div>
  </div>
);
const Row = ({ k, v }) => (
  <div className="flex justify-between gap-4 px-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right text-ink">{v}</dd></div>
);
