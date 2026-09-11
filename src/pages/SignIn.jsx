import { useState } from 'react';
import { useSession } from '../lib/session';

/* Sign-in: the panel can change prices and cancel passes, so it asks for a
   mobile number and a real password, and says as little as possible about which
   of the two was wrong. */
export default function SignIn() {
  const { signIn, notice } = useSession();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await signIn(mobile, password);
      if (!out.ok) { setError(out.message); setPassword(''); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
          <p className="mt-1 text-sm text-muted">Use the account your administrator issued.</p>

          {notice && !error && (
            <p className="mt-5 rounded-lg border border-watch-500/25 bg-watch-50 px-3.5 py-2.5 text-sm text-watch-700">{notice}</p>
          )}
          {error && (
            <p className="mt-5 rounded-lg border border-wrong-500/25 bg-wrong-50 px-3.5 py-2.5 text-sm font-medium text-wrong-700">{error}</p>
          )}

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <label className="label" htmlFor="mobile">Mobile number</label>
              <input id="mobile" className="input tabular" inputMode="numeric" autoComplete="username"
                placeholder="10-digit number" value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ]/g, '').slice(0, 14))} />
            </div>

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

          <p className="mt-8 text-2xs text-muted">Pravesha — a product of ServerPe App Solutions</p>
        </div>
      </div>
    </div>
  );
}
