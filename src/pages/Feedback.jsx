import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { useSession, can } from '../lib/session';
import { dayLabel, number, plate } from '../lib/format';
import { Banner, Field, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Feedback — what visitors said, and what may be quoted.
 *
 * TWO DIFFERENT THINGS ON ONE SCREEN, kept apart on purpose.
 *
 * The first is an operational signal, and it is most useful when it is bad. A
 * run of two-star ratings on Sunday mornings is the only way anybody in an
 * office learns that the barrier queue was an hour long, because almost nobody
 * writes in to say so. That is why "unhappy" is a filter and not a footnote.
 *
 * The second is a testimonial: somebody's words and somebody's name on a public
 * marketing page. The visitor did not agree to that by tapping four stars, so
 * publishing is a deliberate act with a reason attached, the name shown is
 * chosen here rather than taken from the booking, and taking it down again is
 * one click.
 *
 * THE AVERAGE IS SHOWN WITH THE RESPONSE RATE, always. Four point six stars from
 * nine people out of six hundred is not a four-point-six-star service, and an
 * average printed on its own invites exactly that mistake.
 */

const STATES = [['', 'Everything'], ['words', 'With words'], ['unhappy', 'Unhappy (1–2★)'],
  ['published', 'Published'], ['unpublished', 'Not published']];

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const Stars = ({ n: count, size = 'text-base' }) => (
  <span className={`${size} leading-none tracking-tight`} aria-label={`${count} out of 5`}>
    <span className="text-watch-500">{'★'.repeat(count)}</span>
    <span className="text-line">{'★'.repeat(5 - count)}</span>
  </span>
);

export default function Feedback() {
  const { me } = useSession();
  const mayPublish = can(me, 'feedback.publish');

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayISO());
  const [state, setState] = useState('');
  const [rating, setRating] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [head, setHead] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(null);   // the one being published
  const [withdrawing, setWithdrawing] = useState(null); // the one being taken down

  useEffect(() => { const id = setTimeout(() => setTerm(q.trim()), 250); return () => clearTimeout(id); }, [q]);

  const load = useCallback(async () => {
    try {
      const [o, l] = await Promise.all([
        api.feedbackOverview({ from, to }),
        api.feedbackList({ from, to, state, rating, q: term, limit: 100 }),
      ]);
      setHead(o);
      setRows(l);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [from, to, state, rating, term]);

  useEffect(() => { load(); }, [load]);

  const t = head?.totals;

  return (
    <Shell
      title="Feedback"
      subtitle={t ? `${number(t.answers)} answer${t.answers === 1 ? '' : 's'}${t.answers ? ` · ${t.average} average` : ''}` : 'Loading…'}
    >
      {error && <Banner tone="wrong">{error}</Banner>}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-2xs text-muted">From
          <input type="date" className="input mt-1" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-2xs text-muted">To
          <input type="date" className="input mt-1" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select className="input w-auto" value={state} onChange={(e) => setState(e.target.value)}>
          {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-auto" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} star{r === 1 ? '' : 's'}</option>)}
        </select>
        <input className="input min-w-[200px] flex-1" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Words, visitor, pass number or plate" />
      </div>

      {!head ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card px-4 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted">Average</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-xl font-bold text-ink">{t.answers ? t.average : '—'}</span>
                {t.answers > 0 && <Stars n={Math.round(t.average)} size="text-sm" />}
              </div>
              {/* Never the average alone. */}
              <div className="text-2xs text-muted">
                {t.responseRate === null
                  ? `${number(t.answers)} answered`
                  : `${number(t.answers)} of ${number(t.entered)} who came · ${t.responseRate}% answered`}
              </div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted">Unhappy</div>
              <div className="mt-0.5 text-xl font-bold text-wrong-700">{number(t.unhappy)}</div>
              <div className="text-2xs text-muted">rated one or two stars</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted">Wrote something</div>
              <div className="mt-0.5 text-xl font-bold text-ink">{number(t.withWords)}</div>
              <div className="text-2xs text-muted">the only ones that can be quoted</div>
            </div>
            <div className="card px-4 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted">Published</div>
              <div className="mt-0.5 text-xl font-bold text-ink">{number(t.published)}</div>
              <div className="text-2xs text-muted">showing on the public site</div>
            </div>
          </div>

          {head.byStar.some((s) => s.answers > 0) && (
            <div className="card mb-5 px-5 py-4">
              {head.byStar.map((s) => {
                const pct = t.answers ? Math.round((s.answers / t.answers) * 100) : 0;
                return (
                  <div key={s.rating} className="flex items-center gap-3 py-0.5">
                    <span className="w-14 shrink-0"><Stars n={s.rating} size="text-2xs" /></span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-shell">
                      <div className={`h-full rounded-full ${s.rating >= 4 ? 'bg-good-500' : s.rating === 3 ? 'bg-watch-500' : 'bg-wrong-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular w-16 shrink-0 text-right text-2xs text-muted">{number(s.answers)} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {!rows ? <Loading /> : rows.feedback.length === 0 ? (
            <div className="card px-5 py-12 text-center text-sm text-muted">
              Nobody has answered in this period. Visitors are asked once, at the gate, after their vehicle is checked in.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.feedback.map((f) => (
                <div key={f.id} className="card px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars n={f.rating} />
                        <span className="text-sm font-medium text-ink">{f.visitor || 'No name given'}</span>
                        <span className="text-2xs text-muted">{f.mobile}</span>
                        {f.published && <span className="chip bg-good-50 text-good-700">Published as “{f.displayName}”</span>}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted">
                        {when(f.at)}
                        {f.editedAt ? ` · changed ${when(f.editedAt)}` : ''}
                        {f.ticketNo ? ` · ${f.ticketNo}` : ''}
                        {f.regNo ? ` · ${plate(f.regNo)}` : ''}
                        {f.travelDate ? ` · visited ${dayLabel(f.travelDate)}` : ''}
                      </div>
                    </div>

                    {mayPublish && f.comment && (
                      f.published
                        ? <button type="button" className="btn-quiet !py-1.5 text-2xs" onClick={() => setWithdrawing(f)}>Take down</button>
                        : <button type="button" className="btn-primary !py-1.5 text-2xs" onClick={() => setPublishing({ ...f, name: (f.visitor || '').split(' ')[0] || '' })}>
                            Publish as testimonial
                          </button>
                    )}
                  </div>

                  {f.comment
                    ? <p className="mt-3 whitespace-pre-wrap border-l-2 border-line pl-3 text-sm text-ink">{f.comment}</p>
                    : <p className="mt-3 text-2xs italic text-muted">A rating with no words — nothing to quote.</p>}

                  {f.note && <p className="mt-2 text-2xs text-muted">Decision: {f.note}{f.publishedBy ? ` · ${f.publishedBy}` : ''}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {publishing && <PublishModal item={publishing} onClose={() => setPublishing(null)} onDone={() => { setPublishing(null); load(); }} />}
      {withdrawing && <WithdrawModal item={withdrawing} onClose={() => setWithdrawing(null)} onDone={() => { setWithdrawing(null); load(); }} />}
    </Shell>
  );
}

/*
 * Publishing asks two things: what name to print, and why.
 *
 * The name is not taken from the booking — a name typed to receive a pass is not
 * a name somebody offered to see on a marketing page — and the words are shown
 * exactly as written, because a testimonial that has been improved is not a
 * testimonial.
 */
function PublishModal({ item, onClose, onDone }) {
  const [name, setName] = useState(item.name || '');
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();

  return (
    <Modal title="Publish as a testimonial" onClose={onClose}>
      <p className="text-sm text-muted">
        This puts the words below on the public site, with the name you choose. The visitor was told nothing would be
        published unless somebody asked for it — so publish what reads as a fair account, not only what flatters.
      </p>

      <blockquote className="mt-3 rounded-lg bg-shell px-4 py-3 text-sm text-ink">
        <Stars n={item.rating} size="text-sm" />
        <p className="mt-1 whitespace-pre-wrap">{item.comment}</p>
      </blockquote>

      <Field label="Name to show" hint="A first name is usually right. It is printed exactly as typed here.">
        <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Shiva" />
      </Field>

      <Reason value={reason} onChange={setReason}
        placeholder="e.g. A fair account of a busy Sunday, and they agreed on the phone" />
      {error && <Banner tone="wrong">{error}</Banner>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy || name.trim().length < 2 || !reasonOk(reason)}
          onClick={async () => {
            const out = await run(() => api.publishFeedback(item.id, { publish: true, displayName: name.trim(), reason }));
            if (out) onDone();
          }}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </Modal>
  );
}

function WithdrawModal({ item, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();

  return (
    <Modal title="Take it down" onClose={onClose}>
      <p className="text-sm text-muted">
        It stops appearing on the public site immediately. The feedback itself is kept — only the publishing is undone.
      </p>
      <blockquote className="mt-3 rounded-lg bg-shell px-4 py-3 text-sm text-ink">
        <p className="whitespace-pre-wrap">{item.comment}</p>
        <p className="mt-1 text-2xs text-muted">Published as “{item.displayName}”{item.publishedBy ? ` by ${item.publishedBy}` : ''}</p>
      </blockquote>

      <Reason value={reason} onChange={setReason}
        placeholder="e.g. The visitor asked us to remove it" />
      {error && <Banner tone="wrong">{error}</Banner>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
        <button type="button" className="btn bg-wrong-500 text-white hover:bg-wrong-700" disabled={busy || !reasonOk(reason)}
          onClick={async () => {
            const out = await run(() => api.publishFeedback(item.id, { publish: false, reason }));
            if (out) onDone();
          }}>
          {busy ? 'Taking down…' : 'Take down'}
        </button>
      </div>
    </Modal>
  );
}
