import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { clock, dayLabel, plate } from '../lib/format';

/*
 * Conversations — the visitor communication centre.
 *
 * Three panes, the way support actually works a question: who wrote (the list),
 * what was said and what happened (the thread), and who they are (the profile).
 *
 * THE THREAD IS WHATSAPP, NOT A LOG. Visitor on the left, Pravesha on the right,
 * buttons under the message they belonged to, the PDF as a document — so support
 * sees exactly what the visitor saw. Booking events (a pass held, a payment that
 * failed, an entry at the gate) sit between the messages as markers, which is
 * how "I paid but got nothing" gets answered from one screen.
 *
 * A SEND THAT FAILED SAYS SO, IN WORDS. "Not delivered: more than 24 hours since
 * the visitor last wrote" is something support can act on; a red dot is not.
 *
 * THE TECHNICAL PANEL is only returned to an administrator, and the API records
 * each time it is opened. It says plainly what is not collected.
 */

export default function Conversations() {
  const { me } = useSession();
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [error, setError] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const bottom = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const d = await api.conversations({ q: q.trim() || null });
      setList(d.conversations);
      setError(null);
      setSelected((cur) => cur || d.conversations[0]?.id || null);
    } catch (e) {
      setError(e.message);
    }
  }, [q]);

  useEffect(() => {
    const id = setTimeout(loadList, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [loadList, q]);

  const loadThread = useCallback(async (id, { quiet = false } = {}) => {
    if (!id) return;
    if (!quiet) setLoadingThread(true);
    try {
      setThread(await api.conversation(id));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => { loadThread(selected); }, [selected, loadThread]);

  /* A conversation that is open keeps up with new messages, quietly. */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadList();
      if (selected) loadThread(selected, { quiet: true });
    }, 15000);
    return () => clearInterval(id);
  }, [selected, loadList, loadThread]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [thread?.timeline?.length]);

  return (
    <Shell title="Conversations — visitor communication centre" subtitle="WhatsApp conversations, with each booking's payments, passes and gate events">
      {error && (
        <div className="mb-4 rounded-lg border border-wrong-500/25 bg-wrong-50 px-4 py-3 text-sm font-medium text-wrong-700">{error}</div>
      )}

      <div className="grid gap-4 lg:h-[calc(100vh-9rem)] lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_340px]">
        {/* List */}
        <section className="card flex min-h-[320px] flex-col overflow-hidden">
          <div className="border-b border-line p-3">
            <input className="input !py-2" placeholder="Search name, mobile, pass or vehicle" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {list === null && <li className="p-4 text-sm text-muted">Loading…</li>}
            {list && list.length === 0 && <li className="p-6 text-center text-sm text-muted">No conversations{q ? ' match' : ' yet'}.</li>}
            {list && list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setSelected(c.id)}
                  className={`w-full px-4 py-3 text-left transition ${selected === c.id ? 'bg-brand/5' : 'hover:bg-shell'}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{c.name || c.mobile}</span>
                    <span className="shrink-0 text-2xs text-muted">{whenShort(c.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
                    <span className="font-mono">{c.mobile}</span>
                    {c.ticketNo && <><span>·</span><span className="font-mono">{c.ticketNo}</span></>}
                  </div>
                  <p className="mt-1 truncate text-[13px] text-body">
                    {c.lastFrom === 'pravesha' && <span className="text-muted">You: </span>}{c.preview}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <StatusChip status={c.status} />
                    {c.failed > 0 && <span className="chip bg-wrong-50 text-wrong-700">{c.failed} failed</span>}
                    {c.windowOpen && <span className="chip bg-good-50 text-good-700" title="Free-form replies allowed">24h open</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Thread */}
        <section className="card flex min-h-[480px] flex-col overflow-hidden">
          {!thread && !loadingThread && <div className="grid flex-1 place-items-center text-sm text-muted">Choose a conversation.</div>}
          {loadingThread && !thread && <div className="grid flex-1 place-items-center text-sm text-muted">Opening…</div>}
          {thread && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line bg-brand px-4 py-2.5 text-white">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{thread.profile.name || thread.profile.mobile}</div>
                  <div className="text-2xs text-white/70">
                    {thread.profile.mobile} · {thread.counts.fromVisitor} from visitor · {thread.counts.fromPravesha} from Pravesha
                    {thread.counts.failedSends ? ` · ${thread.counts.failedSends} not delivered` : ''}
                  </div>
                </div>
                <span className={`chip ${thread.profile.windowOpen ? 'bg-white/20 text-white' : 'bg-black/20 text-white/80'}`}
                  title={thread.profile.windowOpen ? 'The visitor wrote within 24 hours: free-form replies are allowed' : 'Only an approved template can reach them now'}>
                  {thread.profile.windowOpen ? 'Reply window open' : 'Template only'}
                </span>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto bg-[#efeae2] px-3 py-4 sm:px-6">
                {thread.timeline.map((e, i) => {
                  const prev = thread.timeline[i - 1];
                  const newDay = !prev || new Date(prev.at).toDateString() !== new Date(e.at).toDateString();
                  return (
                    <Fragment key={e.id}>
                      {newDay && (
                        <div className="flex justify-center py-2">
                          <span className="rounded-md bg-white/90 px-2.5 py-1 text-2xs font-medium text-muted shadow-sm">{dayLabel(new Date(e.at).toISOString().slice(0, 10))}</span>
                        </div>
                      )}
                      {e.type === 'event' ? <EventMarker e={e} /> : <Bubble m={e} />}
                    </Fragment>
                  );
                })}
                <div ref={bottom} />
              </div>

              <div className="border-t border-line bg-shell px-4 py-2.5 text-2xs text-muted">
                Replies are sent by the Pravesha bot. This view is read-only.
              </div>
            </>
          )}
        </section>

        {/* Profile */}
        {thread && <Profile thread={thread} isAdmin={me?.can?.configure} />}
      </div>
    </Shell>
  );
}

function whenShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? clock(iso) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATUS_TONE = {
  failed: 'bg-wrong-50 text-wrong-700',
  payment_failed: 'bg-wrong-50 text-wrong-700',
  entered: 'bg-good-50 text-good-700',
  pass: 'bg-brand/10 text-brand',
  paying: 'bg-watch-50 text-watch-700',
  abandoned: 'bg-shell text-muted',
  browsing: 'bg-shell text-muted',
  open: 'bg-shell text-muted',
};
const StatusChip = ({ status }) => <span className={`chip ${STATUS_TONE[status.key] || 'bg-shell text-muted'}`}>{status.label}</span>;

/* WhatsApp's own light formatting: *bold*, _italic_, ~strike~ and line breaks. */
function WaText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (/^\*[^*]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^~[^~]+~$/.test(part)) return <s key={i}>{part.slice(1, -1)}</s>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}

function Bubble({ m }) {
  const mine = m.from === 'pravesha';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] rounded-lg px-3 py-2 text-[14px] leading-snug text-ink shadow-sm sm:max-w-[70%] ${mine ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'} ${m.failure ? 'ring-1 ring-wrong-500/40' : ''}`}>
        {m.kind === 'tap' && <div className="mb-0.5 text-2xs font-semibold uppercase tracking-wider text-brand-light">Tapped</div>}
        {m.header && <div className="mb-1 font-semibold">{m.header}</div>}

        {m.kind === 'document' ? (
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-9 shrink-0 place-items-center rounded bg-wrong-500 text-2xs font-bold text-white">PDF</span>
            <div className="min-w-0"><div className="truncate text-[13px]"><WaText text={m.text} /></div>{m.filename && <div className="text-2xs text-muted">{m.filename}</div>}</div>
          </div>
        ) : m.kind === 'template' ? (
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Template · {m.template} · {m.language}</div>
            {m.params?.length > 0 && <div className="mt-1 text-[13px] text-body">{m.params.join(' · ')}</div>}
          </div>
        ) : (
          <WaText text={m.text} />
        )}

        {m.footer && <div className="mt-1 text-2xs text-muted">{m.footer}</div>}

        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
          {clock(m.at)}
          {mine && !m.failure && <span className="text-brand-light" aria-label="sent">✓✓</span>}
        </div>

        {m.buttons?.length > 0 && (
          <div className="-mx-3 -mb-2 mt-2 divide-y divide-black/5 border-t border-black/5">
            {m.buttons.map((b) => <div key={b} className="px-3 py-1.5 text-center text-[13px] font-medium text-brand-light">{b}</div>)}
          </div>
        )}
        {m.kind === 'list' && (
          <div className="-mx-3 -mb-2 mt-2 border-t border-black/5 px-3 py-1.5 text-center text-[13px] font-medium text-brand-light">
            ☰ {m.buttonText || 'Options'}{m.options?.length ? ` (${m.options.length})` : ''}
          </div>
        )}
        {m.kind === 'link' && (
          <div className="-mx-3 -mb-2 mt-2 border-t border-black/5 px-3 py-1.5 text-center text-[13px] font-medium text-brand-light" title={m.linkTo || ''}>
            ↗ {m.linkText || 'Open link'}
          </div>
        )}

        {m.failure && <div className="mt-2 rounded bg-wrong-50 px-2 py-1 text-2xs font-medium text-wrong-700">✕ {m.failure}</div>}
      </div>
    </div>
  );
}

const EVENT_TONE = {
  booking: 'bg-white text-body',
  payment_paid: 'bg-good-50 text-good-700',
  payment_failed: 'bg-wrong-50 text-wrong-700',
  abandoned: 'bg-watch-50 text-watch-700',
  entered: 'bg-good-50 text-good-700',
  refused: 'bg-wrong-50 text-wrong-700',
  refund: 'bg-watch-50 text-watch-700',
};

function EventMarker({ e }) {
  return (
    <div className="flex justify-center py-1">
      <div className={`max-w-[90%] rounded-md px-3 py-1.5 text-center shadow-sm ${EVENT_TONE[e.event] || 'bg-white text-body'}`}>
        <div className="text-2xs font-semibold uppercase tracking-wider">{e.title} · {clock(e.at)}</div>
        <div className="text-[12px] opacity-90">{e.detail}</div>
      </div>
    </div>
  );
}

function Profile({ thread, isAdmin }) {
  const p = thread.profile;
  const t = thread.technical;
  return (
    <aside className="card overflow-y-auto lg:col-span-2 xl:col-span-1">
      <div className="border-b border-line p-4">
        <div className="text-base font-semibold text-ink">{p.name || 'Visitor'}</div>
        <div className="font-mono text-sm text-muted">{p.mobile}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip bg-shell text-body">{p.language}</span>
          {p.termsAccepted && <span className="chip bg-good-50 text-good-700" title={new Date(p.termsAccepted.at).toLocaleString('en-IN')}>Terms v{p.termsAccepted.version} accepted</span>}
          {p.blocked && <span className="chip bg-wrong-50 text-wrong-700">{p.blocked}</span>}
          {p.isTest && <span className="chip bg-watch-50 text-watch-700">Test data</span>}
        </div>
      </div>

      <Block title="At a glance">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Row label="First seen" value={p.firstSeen ? new Date(p.firstSeen).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'} />
          <Row label="Last seen" value={p.lastSeen ? `${whenShort(p.lastSeen)}` : '—'} />
          <Row label="Visits" value={p.visits} />
          <Row label="Passes" value={p.passes.length} />
        </dl>
      </Block>

      <Block title="Vehicles">
        {p.vehicles.length ? (
          <div className="flex flex-wrap gap-1.5">{p.vehicles.map((v) => <span key={v} className="chip bg-shell font-mono text-ink">{plate(v)}</span>)}</div>
        ) : <Empty />}
      </Block>

      <Block title="Passes">
        {p.passes.length ? (
          <ul className="space-y-2">
            {p.passes.map((x) => (
              <li key={x.ticketNo} className="rounded-lg border border-line p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-2xs font-semibold text-ink">{x.ticketNo}</span>
                  <PassStatus status={x.status} />
                </div>
                <div className="mt-1 text-2xs text-muted">{dayLabel(x.travelDate)} · {x.slot}</div>
                <div className="text-2xs text-muted">{plate(x.regNo)} · {x.type} · ₹{x.amount}{x.isTest ? ' · test' : ''}</div>
              </li>
            ))}
          </ul>
        ) : <Empty />}
      </Block>

      <Block title="Payments">
        {p.payments.length ? (
          <ul className="space-y-1.5 text-sm">
            {p.payments.map((x, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-body">₹{x.amount}{x.method ? ` · ${x.method.toUpperCase()}` : ''}{x.simulated ? ' · simulated' : ''}</span>
                <span className={`chip ${x.status === 'paid' ? 'bg-good-50 text-good-700' : x.status === 'failed' ? 'bg-wrong-50 text-wrong-700' : 'bg-shell text-muted'}`}>{x.status}</span>
              </li>
            ))}
          </ul>
        ) : <Empty />}
      </Block>

      {p.deletionRequests.length > 0 && (
        <Block title="Data deletion requests">
          <ul className="space-y-1 text-sm">
            {p.deletionRequests.map((d) => <li key={d.reference} className="flex justify-between"><span className="font-mono text-2xs">{d.reference}</span><span className="text-2xs text-muted">{d.status}</span></li>)}
          </ul>
        </Block>
      )}

      <Block title="Technical information" last>
        {!isAdmin || !t ? (
          <p className="text-2xs text-muted">Visible to administrators only.</p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-y-1.5 text-2xs">
              <Tech label="Customer ID" value={t.customerId} />
              <Tech label="Mobile" value={t.mobile} />
              <Tech label="WhatsApp ID" value={t.whatsappId} />
              <Tech label="Session ID" value={t.sessionId} />
              <Tech label="Session state" value={t.sessionState} />
              <Tech label="Last inbound" value={t.lastInbound && new Date(t.lastInbound).toLocaleString('en-IN')} />
              <Tech label="Last outbound" value={t.lastOutbound && new Date(t.lastOutbound).toLocaleString('en-IN')} />
              <Tech label="First seen" value={t.firstSeen && new Date(t.firstSeen).toLocaleString('en-IN')} />
              <Tech label="Terms version" value={t.termsVersion} />
            </dl>
            <div className="mt-3 rounded-lg bg-shell p-2.5 text-2xs text-muted">
              <div className="font-semibold text-body">Not collected</div>
              <div className="mt-0.5">{t.notCollected.join(' · ')}</div>
              <div className="mt-1.5">{t.notCollectedReason}</div>
            </div>
            <p className="mt-2 text-2xs text-muted">Opening this panel is recorded in the audit trail.</p>
          </>
        )}
      </Block>
    </aside>
  );
}

const Block = ({ title, children, last }) => (
  <div className={`p-4 ${last ? '' : 'border-b border-line'}`}>
    <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">{title}</h4>
    {children}
  </div>
);
const Row = ({ label, value }) => (
  <div><dt className="text-2xs text-muted">{label}</dt><dd className="font-medium text-ink">{value}</dd></div>
);
const Tech = ({ label, value }) => (
  <div className="flex justify-between gap-3"><dt className="text-muted">{label}</dt><dd className="truncate font-mono text-ink">{value || '—'}</dd></div>
);
const Empty = () => <p className="text-2xs text-muted">None</p>;

const PASS_TONE = { used: ['Entered', 'bg-good-50 text-good-700'], paid: ['Booked', 'bg-brand/10 text-brand'], expired: ['Abandoned', 'bg-shell text-muted'], held: ['At payment', 'bg-watch-50 text-watch-700'] };
const PassStatus = ({ status }) => {
  const [label, tone] = PASS_TONE[status] || [status, 'bg-shell text-muted'];
  return <span className={`chip ${tone}`}>{label}</span>;
};
