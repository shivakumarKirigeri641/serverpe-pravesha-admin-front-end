import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { Banner, Loading, when } from '../components/ui.jsx';

/*
 * System Health — is Pravesha working right now?
 *
 * Every service is judged on what actually happened here: messages we sent,
 * payments visitors made, look-ups we asked for. Nothing on this screen calls
 * Meta or Razorpay, so opening it during an outage cannot make one worse.
 *
 * "Quiet" is its own state and is not green: nothing has happened recently
 * enough to say whether it works.
 */

const STATES = {
  working: ['Working', 'bg-good-50 text-good-700', 'border-good-500/30', '●'],
  degraded: ['Needs attention', 'bg-watch-50 text-watch-700', 'border-watch-500/30', '▲'],
  failing: ['Failing', 'bg-wrong-50 text-wrong-700', 'border-wrong-500/30', '■'],
  quiet: ['Quiet', 'bg-shell text-muted', 'border-line', '○'],
};

export default function Health() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setData(await api.health()); setError(null); } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => { api.health().then(setData).catch(() => {}); }, 60000); return () => clearInterval(t); }, []);

  const overall = data ? STATES[data.overall] : null;

  return (
    <Shell title="System Health — Platform Status"
      subtitle={data ? `${data.overallLabel} · checked ${when(data.at)} in ${data.responseMs} ms` : 'WhatsApp, payments, database, look-ups and delivery'}
      actions={<button type="button" className="btn-quiet !py-1.5 text-2xs" disabled={refreshing} onClick={load}>{refreshing ? 'Checking…' : 'Check again'}</button>}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {!data && !error && <Loading rows={4} />}

      {data && (
        <div className="space-y-6">
          <div className={`card border p-5 ${overall[2]}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${overall[1]}`}>{overall[3]} {overall[0]}</span>
                  <h2 className="text-base font-semibold text-ink">{data.overallLabel}</h2>
                </div>
                {data.quietServices?.length > 0 && (
                  <p className="mt-1 text-2xs text-muted">
                    Nothing recent to judge {data.quietServices.join(' or ').toLowerCase()} by.
                  </p>
                )}
                <p className="mt-1 max-w-3xl text-2xs text-muted">{data.note}</p>
              </div>
              <div className="text-right">
                <div className="text-2xs text-muted">This check took</div>
                <div className="tabular text-xl font-bold text-ink">{number(data.responseMs)} ms</div>
              </div>
            </div>
          </div>

          <section>
            <h2 className="mb-2.5 text-[15px] font-semibold text-ink">Services</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.services.map((s) => {
                const [label, chip, border] = STATES[s.state] || STATES.quiet;
                return (
                  <article key={s.key} className={`card border p-4 ${border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink">{s.label}</h3>
                      <span className={`chip ${chip}`}>{label}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-body">{s.headline}</p>
                    <p className="text-2xs text-muted">{s.detail}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-3">
                      {s.metrics.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-2">
                          <dt className="text-2xs text-muted">{k}</dt>
                          <dd className="tabular text-2xs font-semibold text-ink">{typeof v === 'number' ? number(v) : v}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2.5">
              <h2 className="text-[15px] font-semibold text-ink">Configuration</h2>
              <p className="text-2xs text-muted">Whether each setting is present — the values themselves are never read out</p>
            </div>
            <div className="card overflow-hidden">
              <ul className="divide-y divide-line">
                {data.configuration.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <div className="text-sm text-ink">{c.label}</div>
                      <div className="text-2xs text-muted">{c.note}</div>
                    </div>
                    {c.ready
                      ? <span className="chip bg-good-50 text-good-700">Set</span>
                      : <span className="chip bg-watch-50 text-watch-700">Not set</span>}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <div className="mb-2.5">
              <h2 className="text-[15px] font-semibold text-ink">Message failures</h2>
              <p className="text-2xs text-muted">Outgoing WhatsApp messages that did not go, in the last seven days</p>
            </div>
            {data.failures.length === 0 ? (
              <p className="card px-4 py-8 text-center text-sm text-muted">No delivery failures.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-line bg-shell">
                    <tr><th className="th">When</th><th className="th">To</th><th className="th">Message</th><th className="th">What the platform said</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.failures.map((f, i) => (
                      <tr key={i}>
                        <td className="td whitespace-nowrap text-2xs text-muted">{when(f.at)}</td>
                        <td className="td text-sm">{f.mobile || '—'}</td>
                        <td className="td text-sm">{f.type || '—'}</td>
                        <td className="td max-w-lg text-2xs text-wrong-700">{f.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
