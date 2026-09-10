/**
 * The sign-in screen.
 *
 * Deliberately plain and unbranded beyond the name. This is the first thing a
 * government officer sees, and the impression it needs to give is "this is a
 * system of record", not "this is a product".
 *
 * The error text never distinguishes an unknown mobile number from a wrong
 * password — telling a stranger which numbers are administrators is a free gift
 * to whoever is guessing.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';

export default function Login({ onSignedIn }) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.post('/login', { mobile, password }, { quiet: true });
      setToken(r.token);
      onSignedIn(r.admin);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* The left panel says what this is, for someone who has been sent a link
          and does not yet know. */}
      <div className="hidden lg:flex flex-col justify-between bg-ink-900 text-ink-300 p-10">
        <div>
          <div className="text-2xs uppercase tracking-[0.2em] text-forest-500">
            Entry ticketing
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white leading-tight">
            Vehicle entry ticketing<br />for tourist places
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Tickets are booked on WhatsApp and carry a digitally signed QR code.
            The checkpost verifies each one at the gate, with or without a network
            connection, and every scan is recorded against the staff member who made it.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-4 text-sm">
          {[
            ['Signed', 'Tickets cannot be edited'],
            ['Verified', 'Checked at the gate, not read'],
            ['Recorded', 'Every scan attributed'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-forest-500 font-semibold">{k}</dt>
              <dd className="text-2xs text-ink-400 mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="text-2xs text-ink-600">Powered by ServerPe App Solutions</div>
      </div>

      {/* The form */}
      <div className="flex items-center justify-center p-6 bg-paper">
        <form onSubmit={submit} className="card w-full max-w-sm p-7">
          <h2 className="text-lg font-semibold text-ink-900">Administration sign in</h2>
          <p className="mt-1 text-sm text-ink-500">
            Use the mobile number registered for your account.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <div className="label">Mobile number</div>
              <input className="input mt-1 tnum" inputMode="numeric" autoComplete="username"
                     value={mobile} onChange={(e) => setMobile(e.target.value)}
                     placeholder="10 digits" required />
            </label>

            <label className="block">
              <div className="label">Password</div>
              <input className="input mt-1" type="password" autoComplete="current-password"
                     value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-refused-soft px-3 py-2 text-sm text-refused">
              {error}
            </div>
          )}

          <button className="btn-primary w-full mt-6" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-5 text-2xs text-ink-400 leading-relaxed">
            This panel holds visitors' personal data and departmental revenue records.
            Every action taken here is recorded against your account.
          </p>
        </form>
      </div>
    </div>
  );
}
