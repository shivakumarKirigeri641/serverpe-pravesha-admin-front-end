import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Banner, Field, Modal, useAction } from '../../components/ui.jsx';

/*
 * Add a person — name, mobile, a code, then the account (user, 2026-09-16).
 *
 * One form for checkpost staff and panel users alike, opened from either
 * screen. The kind of account is the last choice, not the first, because the
 * first thing that matters is that the number really is this person's: they
 * read the code off their own phone before anything is switched on. A mistyped
 * digit used to create an account for a stranger, who would then be the one
 * receiving its sign-in codes.
 *
 * WHAT IS OFFERED IS WHAT THE SERVER WILL ACCEPT. A checkpost admin sees only
 * "Checkpost staff" and no gate picker — their staff report to their own gate.
 * The super administrator sees every kind, and names the gate a checkpost admin
 * will run. The server applies the same limits whatever this form sends.
 *
 * `prefer` preselects a kind: the staff screen opens it on "Checkpost staff".
 */

const STEPS = ['Details', 'Verify', 'Account'];

export default function AddPerson({ prefer = null, onClose, onDone }) {
  const [opts, setOpts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);      // the answer to "Get code"
  const [type, setType] = useState(prefer);
  const [gate, setGate] = useState('');
  const [posts, setPosts] = useState(() => new Set());
  const { busy, error, run, setError } = useAction();

  useEffect(() => {
    api.peopleOptions()
      .then((o) => {
        setOpts(o);
        /* A preference the server does not offer this person is dropped. */
        if (prefer && !o.types.some((t) => t.key === prefer)) setType(o.types[0]?.key || null);
        if (!prefer && o.types.length === 1) setType(o.types[0].key);
        if (o.checkposts.length === 1) { setGate(o.checkposts[0].id); setPosts(new Set([o.checkposts[0].id])); }
      })
      .catch((e) => setLoadError(e.message));
  }, [prefer]);

  const nameOk = name.trim().length >= 2;
  const mobileOk = /^\d{10}$/.test(mobile);
  const isStaff = type === 'staff';
  const needsGate = type === 'checkpost_manager';
  const fixed = opts?.fixedCheckpost;

  async function getCode() {
    const out = await run(() => api.peopleCode(mobile));
    if (out) { setSent(out); setCode(''); setStep(1); }
  }

  async function verify() {
    const out = await run(() => api.peopleVerify(mobile, code));
    if (out) setStep(2);
  }

  async function enable() {
    const body = { name: name.trim(), mobile, type };
    if (isStaff && !fixed) body.checkpostIds = [...posts];
    if (needsGate) body.checkpostId = gate;
    const out = await run(() => api.enrolPerson(body));
    if (out) onDone(out, name.trim());
  }

  const accountReady = type && (!isStaff || fixed || posts.size > 0) && (!needsGate || gate);
  const chosen = opts?.types.find((t) => t.key === type);

  const footer = (
    <>
      <button type="button" className="btn-quiet" disabled={busy}
        onClick={() => { setError(null); if (step === 0) onClose(); else setStep(step - 1); }}>
        {step === 0 ? 'Cancel' : 'Back'}
      </button>
      {step === 0 && (
        <button type="button" className="btn-primary" onClick={getCode} disabled={busy || !nameOk || !mobileOk}>
          {busy ? 'Sending…' : 'Get code'}
        </button>
      )}
      {step === 1 && (
        <button type="button" className="btn-primary" onClick={verify} disabled={busy || code.length !== 4}>
          {busy ? 'Checking…' : 'Verify'}
        </button>
      )}
      {step === 2 && (
        <button type="button" className="btn-primary" onClick={enable} disabled={busy || !accountReady}>
          {busy ? 'Enabling…' : chosen ? `Enable as ${chosen.label}` : 'Enable'}
        </button>
      )}
    </>
  );

  return (
    <Modal title="Add a person" subtitle="Their number is verified with a code before the account is switched on"
      onClose={onClose} busy={busy} wide footer={opts ? footer : null}>
      {loadError && <Banner tone="wrong">{loadError}</Banner>}
      {!opts && !loadError && <p className="text-sm text-muted">Loading…</p>}

      {opts && (
        <>
          {/* Where they are in it. */}
          <ol className="flex items-center gap-2 text-2xs font-semibold">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${
                  i < step ? 'bg-good-500 text-white' : i === step ? 'bg-brand text-white' : 'bg-shell text-muted'}`}>
                  {i < step ? '✓' : i + 1}
                </span>
                <span className={i === step ? 'text-ink' : 'text-muted'}>{s}</span>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" aria-hidden />}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Mobile number" hint="A 4-digit code goes to this number">
                <input className="input tabular" inputMode="numeric" maxLength={10} value={mobile} placeholder="10 digits"
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-body">
                Ask <b className="text-ink">{name.trim()}</b> for the code sent to <b className="tabular text-ink">{mobile}</b>.
                It is valid for {sent?.minutes || opts.codeMinutes} minutes.
              </p>
              {(sent?.alreadyStaff || sent?.alreadyUser) && (
                <Banner tone="watch">
                  This number already belongs to {[
                    sent.alreadyStaff && `${sent.alreadyStaff} (checkpost staff)`,
                    sent.alreadyUser && `${sent.alreadyUser} (panel user)`,
                  ].filter(Boolean).join(' and ')}. You can still add the other kind of account.
                </Banner>
              )}
              <Field label="Code">
                <input className="input tabular max-w-[10rem] text-center text-lg tracking-[.4em]" inputMode="numeric"
                  maxLength={4} value={code} autoFocus placeholder="••••"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 4) verify(); }} />
              </Field>
              <button type="button" className="text-2xs font-semibold text-brand underline disabled:opacity-50"
                disabled={busy} onClick={getCode}>Send a new code</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Banner tone="good">{mobile} verified for {name.trim()}.</Banner>

              <div>
                <span className="label">What will they be?</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {opts.types.map((t) => (
                    <label key={t.key}
                      className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        type === t.key ? 'border-brand bg-brand/5' : 'border-line hover:border-muted/40'}`}>
                      <input type="radio" name="type" className="mt-1 h-4 w-4 accent-brand"
                        checked={type === t.key} onChange={() => setType(t.key)} />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{t.label}</span>
                        <span className="block text-2xs text-muted">{t.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Staff: the gates they report to. A checkpost admin's are fixed. */}
              {isStaff && fixed && (
                <p className="text-sm text-body">
                  They will report to <b className="text-ink">{opts.checkposts[0]?.name}</b>.
                </p>
              )}
              {isStaff && !fixed && (
                <div>
                  <span className="label">Reports to</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {opts.checkposts.map((c) => (
                      <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${
                        posts.has(c.id) ? 'border-brand bg-brand/5' : 'border-line'}`}>
                        <input type="checkbox" className="h-4 w-4 accent-brand" checked={posts.has(c.id)}
                          onChange={() => setPosts((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                        <span>
                          <span className="block text-sm font-semibold text-ink">{c.name}</span>
                          <span className="block text-2xs text-muted">{c.place}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* A checkpost admin runs exactly one gate. */}
              {needsGate && (
                <Field label="Checkpost they will run" hint="Their screens and their staff are limited to this gate">
                  <select className="input" value={gate} onChange={(e) => setGate(e.target.value)}>
                    <option value="">Choose a checkpost…</option>
                    {opts.checkposts.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.place}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          {error && <Banner tone="wrong">{error}</Banner>}
        </>
      )}
    </Modal>
  );
}
