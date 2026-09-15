import { useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

/*
 * Sign-in: a mobile number, then a 4-digit code (2026-09-15). Which screens a
 * person then sees follows from the role their number holds.
 *
 * The password form stays one tap away while codes are fixed for development
 * and not sent by SMS. Both say as little as possible about which part was
 * wrong: a number that is not a panel user is answered like one that is.
 */
export default function SignIn() {
  const { signIn, signInWithCode, notice } = useSession();
  const [mode, setMode] = useState('code');
  const [mobile, setMobile] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const askForCode = (e) => {
    e?.preventDefault();
    run(async () => {
      const out = await api.requestOtp(mobile);
      if (!out.ok) { setError(out.message); return; }
      setSent(true);
      setCode('');
      setInfo(out.message || 'Enter the 4-digit code.');
    });
  };

  const checkCode = (e) => {
    e.preventDefault();
    run(async () => {
      const out = await signInWithCode(mobile, code);
      if (!out.ok) { setError(out.message); setCode(''); }
    });
  };

  const withPassword = (e) => {
    e.preventDefault();
    run(async () => {
      const out = await signIn(mobile, password);
      if (!out.ok) { setError(out.message); setPassword(''); }
    });
  };

  const switchTo = (next) => {
    setMode(next);
    setSent(false);
    setCode('');
    setPassword('');
    setError(null);
    setInfo(null);
  };

  const mobileField = (
    <div>
      <label className="label" htmlFor="mobile">Mobile number</label>
      <div className="relative">
        <input id="mobile" className="input tabular pr-20" inputMode="numeric" autoComplete="username"
          placeholder="10-digit number" value={mobile} disabled={mode === 'code' && sent}
          onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, '').slice(0, 14))} />
        {mode === 'code' && sent && (
          <button type="button" onClick={() => switchTo('code')}
            className="absolute inset-y-0 right-0 px-3 text-2xs font-semibold uppercase tracking-wider text-muted hover:text-ink">
            Change
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_460px]">
      {/* The quiet half: what this is, for whoever opens it by accident. */}
      <div className="relative hidden flex-col justify-between bg-brand-deep p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold">Pravesha</span>
        </div>
        <div>
          <h1 className="max-w-sm text-3xl font-bold leading-tight">Administration</h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
            Bookings, capacity, checkpost staff and revenue for Karnataka&rsquo;s hill destinations.
          </p>
        </div>
        <p className="text-2xs text-white/50">
          Authorised users only. Every change is recorded against your name.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-bold text-ink">Pravesha Admin</span>
          </div>

          <h2 className="text-xl font-bold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'code' ? 'Enter your mobile number to get a sign-in code.' : 'Use the password your administrator issued.'}
          </p>

          {notice && !error && (
            <p className="mt-5 rounded-lg border border-watch-500/25 bg-watch-50 px-3.5 py-2.5 text-sm text-watch-700">{notice}</p>
          )}
          {error && (
            <p className="mt-5 rounded-lg border border-wrong-500/25 bg-wrong-50 px-3.5 py-2.5 text-sm font-medium text-wrong-700">{error}</p>
          )}
          {info && !error && mode === 'code' && sent && (
            <p className="mt-5 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink">{info}</p>
          )}

          {mode === 'code' && !sent && (
            <form className="mt-6 space-y-4" onSubmit={askForCode}>
              {mobileField}
              <button type="submit" className="btn-primary w-full" disabled={busy || mobile.replace(/\D/g, '').length < 10}>
                {busy ? 'Please wait…' : 'Get code'}
              </button>
            </form>
          )}

          {mode === 'code' && sent && (
            <form className="mt-6 space-y-4" onSubmit={checkCode}>
              {mobileField}
              <div>
                <label className="label" htmlFor="code">4-digit code</label>
                <input id="code" className="input tabular tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
                  autoFocus maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 4}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" className="w-full text-sm font-medium text-muted hover:text-ink" disabled={busy} onClick={askForCode}>
                Get a new code
              </button>
            </form>
          )}

          {mode === 'password' && (
            <form className="mt-6 space-y-4" onSubmit={withPassword}>
              {mobileField}
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <input id="password" className="input pr-16" type={show ? 'text' : 'password'}
                    autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-2xs font-semibold uppercase tracking-wider text-muted hover:text-ink">
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={busy || !mobile || !password}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <button type="button" className="mt-5 text-sm font-medium text-brand hover:underline"
            onClick={() => switchTo(mode === 'code' ? 'password' : 'code')}>
            {mode === 'code' ? 'Sign in with a password instead' : 'Sign in with a code instead'}
          </button>

          <p className="mt-8 text-2xs text-muted">Pravesha — a product of ServerPe App Solutions</p>
        </div>
      </div>
    </div>
  );
}
