import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSession, can } from '../../lib/session';
import { Banner, Field, Loading, Reason, reasonOk, useAction, when } from '../../components/ui.jsx';

/*
 * The evening report — who receives it, and what it will say.
 *
 * WHY THE PREVIEW IS THE BIGGEST THING ON THE SCREEN. Nobody here will ever see
 * what a recipient sees: the report goes out at eight in the evening to a phone
 * in somebody else's pocket, and if a figure is wrong or a line reads oddly, the
 * first person to notice is the Deputy Commissioner. So the exact text is shown,
 * for all three periods, computed from today's data.
 *
 * ADDING A NUMBER IS A DECISION, NOT A PREFERENCE. From then on, collection
 * figures arrive on that phone every evening. It asks for a reason and lands in
 * the audit trail with the list before and after — masked there, because the
 * trail should record that the list changed, not keep a second copy of
 * everybody's number.
 *
 * SENDING ONE BY HAND GOES TO ONE NUMBER, TYPED HERE. Testing a template must
 * not be a thing that lands on a DC's phone because somebody wanted to check the
 * layout — so there is no "send to everyone" button, on purpose.
 */

const PERIODS = [
  ['daily', 'Daily', 'Every evening'],
  ['weekly', 'Weekly', 'Sunday evening, for Monday to Sunday'],
  ['monthly', 'Monthly', 'The last evening of the month'],
];

export default function Reports() {
  const { me } = useSession();
  const mayChange = can(me, 'settings.reports');

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [list, setList] = useState('');
  const [sendAt, setSendAt] = useState('20:00');
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState('daily');
  const [testTo, setTestTo] = useState('');
  const [sentNote, setSentNote] = useState(null);

  const save = useAction();
  const test = useAction();

  const load = useCallback(async () => {
    try {
      const d = await api.periodReport();
      setData(d);
      setList(d.recipients.map((r) => r.mobile).join(', '));
      setSendAt(d.sendAt || '20:00');
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !data) return <Banner tone="wrong">{error}</Banner>;
  if (!data) return <Loading />;

  const current = data.recipients.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,420px)]">
      <section>
        <h2 className="text-[15px] font-semibold text-ink">Who receives it</h2>
        <p className="mt-0.5 text-2xs text-muted">
          Template <span className="font-mono">{data.template}</span> · sent at {data.sendAt} IST.
          {current === 0 && ' Nobody is on the list, so nothing is being sent.'}
        </p>

        <div className="card mt-3 space-y-4 p-5">
          <Field label="Mobile numbers"
            hint="Ten digits each, separated by commas. Every number here gets the report each evening.">
            <textarea className="input min-h-[72px] resize-y font-mono text-sm" value={list}
              disabled={!mayChange} onChange={(e) => setList(e.target.value)}
              placeholder="9886122415, 9739622631" />
          </Field>

          <Field label="Time" hint="24-hour, IST. The day is finished by 20:00 — the last entry is at 17:00.">
            <input className="input w-32 font-mono" value={sendAt} disabled={!mayChange}
              onChange={(e) => setSendAt(e.target.value)} placeholder="20:00" />
          </Field>

          {mayChange && (
            <>
              <Reason value={reason} onChange={setReason}
                placeholder="e.g. Adding the DC office number, agreed in the meeting on 12 September" />
              {save.error && <Banner tone="wrong">{save.error}</Banner>}
              <button type="button" className="btn-primary" disabled={save.busy || !reasonOk(reason)}
                onClick={async () => {
                  const out = await save.run(() => api.savePeriodReport({ recipients: list, sendAt, reason }));
                  if (out) { setReason(''); load(); }
                }}>
                {save.busy ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>

        {/* What has actually gone out, so "did the DC get Sunday's?" has an answer. */}
        <h2 className="mt-6 text-[15px] font-semibold text-ink">Last sent</h2>
        <div className="card mt-2 divide-y divide-line px-5">
          {PERIODS.map(([key, label, whenText]) => (
            <div key={key} className="flex items-baseline justify-between gap-4 py-2.5">
              <div>
                <div className="text-sm text-ink">{label}</div>
                <div className="text-2xs text-muted">{whenText}</div>
              </div>
              <div className="text-right text-2xs text-muted">
                {data.lastSent[key] ? `covered ${data.lastSent[key].replace('..', ' → ')}` : 'not yet sent'}
              </div>
            </div>
          ))}
        </div>

        {mayChange && (
          <>
            <h2 className="mt-6 text-[15px] font-semibold text-ink">Send one now, to one number</h2>
            <p className="mt-0.5 text-2xs text-muted">
              For checking that the approved template renders properly. It goes only to the number you type here —
              not to the list.
            </p>
            <div className="card mt-2 space-y-3 p-5">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Send to" className="flex-1">
                  <input className="input font-mono" value={testTo} maxLength={10}
                    onChange={(e) => setTestTo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9886122415" />
                </Field>
                <select className="input w-auto" value={shown} onChange={(e) => setShown(e.target.value)}>
                  {PERIODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button type="button" className="btn-quiet" disabled={test.busy || testTo.length !== 10}
                  onClick={async () => {
                    const out = await test.run(() => api.sendPeriodReport({ kind: shown, to: testTo }));
                    if (out) { setSentNote(out); load(); }
                  }}>
                  {test.busy ? 'Sending…' : 'Send it'}
                </button>
              </div>
              {test.error && <Banner tone="wrong">{test.error}</Banner>}
              {sentNote && (
                <Banner tone="good">
                  {sentNote.kind} report sent to {sentNote.sentTo}, covering {sentNote.period.from}
                  {sentNote.period.from !== sentNote.period.to ? ` → ${sentNote.period.to}` : ''}.
                </Banner>
              )}
            </div>
          </>
        )}
      </section>

      {/* The preview, as large as the screen allows. */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink">What it will say</h2>
        <p className="mt-0.5 text-2xs text-muted">Computed from today's figures. This is the message, not a mock-up.</p>

        <div className="mt-3 flex gap-1">
          {PERIODS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setShown(key)}
              className={`rounded-lg px-3 py-1.5 text-2xs font-semibold ${
                shown === key ? 'bg-brand text-white' : 'border border-line bg-white text-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-2xl bg-[#e5ddd5] p-4">
          <div className="max-w-[340px] rounded-xl bg-white px-3 py-2.5 shadow-sm">
            <pre className="whitespace-pre-wrap break-words font-sans text-[13.5px] leading-snug text-ink">
              {data.preview[shown]}
            </pre>
            <div className="mt-1.5 text-right text-[10px] text-muted">Automatic report · do not reply</div>
          </div>
        </div>

        <p className="mt-2 text-2xs text-muted">
          Covering {data.periods[shown].from}
          {data.periods[shown].from !== data.periods[shown].to ? ` → ${data.periods[shown].to}` : ''}.
        </p>
      </section>
    </div>
  );
}
