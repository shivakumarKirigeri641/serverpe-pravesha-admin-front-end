import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Shell from '../components/Shell.jsx';
import { api } from '../lib/api';
import usePulse from '../lib/usePulse';
import { useSession, can } from '../lib/session';
import { dayLabel, number, plate, rupees } from '../lib/format';
import Rolling from '../components/Rolling.jsx';
import { Banner, Loading, Modal, Reason, reasonOk, useAction, when } from '../components/ui.jsx';

/*
 * Unverified vehicles — the passes that do not rest on the vehicle register.
 *
 * Normally VAHAN says what a vehicle is and the type sets the price. These are
 * the ones where it could not: a temporary registration on a car bought last
 * week, a dealer plate, a look-up that failed, or a vehicle with no number plate
 * at all — and somebody at the barrier said what it was instead.
 *
 * The reason they are worth watching is money: whoever declares the type sets
 * the price. One member of staff declaring nearly everything they sell, or a run
 * of large vehicles declared as two-wheelers, is a pattern nobody can spot
 * without a screen that puts them together — which is not an accusation, it is
 * simply the only way to see it.
 */

const KIND_TONE = {
  declared: 'bg-watch-50 text-watch-700',
  no_plate: 'bg-wrong-50 text-wrong-700',
};

const IDENTITY_LABEL = {
  chassis: 'Chassis', engine: 'Engine', tr_paper: 'TR paper', invoice: 'Invoice', licence: 'Licence', other: 'Note',
};

/*
 * Thumbnails on a row.
 *
 * Small on purpose: this is a table of other people's vehicles, and the point
 * here is "there is a photograph, and it looks like a vehicle", not a gallery.
 * Clicking opens it full size. Loaded with the session token, from a blob, for
 * the same reason the reports are.
 */
function Thumbs({ photos }) {
  const [urls, setUrls] = useState({});
  const [big, setBig] = useState(null);

  useEffect(() => {
    let alive = true;
    const made = [];
    (async () => {
      for (const ph of photos) {
        try {
          const url = await api.photoUrl(ph.id);
          made.push(url);
          if (!alive) return;
          setUrls((m) => ({ ...m, [ph.id]: url }));
        } catch { /* leave the frame empty */ }
      }
    })();
    return () => { alive = false; made.forEach(URL.revokeObjectURL); };
  }, [photos]);

  return (
    <>
      <div className="mt-1 flex gap-1">
        {photos.map((ph) => (
          <button key={ph.id} type="button" title="Photograph taken at the gate"
            onClick={() => urls[ph.id] && setBig(urls[ph.id])}
            className="h-10 w-10 overflow-hidden rounded border border-line bg-shell">
            {urls[ph.id] && <img src={urls[ph.id]} alt="" className="h-full w-full object-cover" />}
          </button>
        ))}
      </div>
      {big && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-6" onClick={() => setBig(null)}>
          <img src={big} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}

export default function Unverified() {
  const { me } = useSession();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(null);
  const [notice, setNotice] = useState(null);
  const size = 25;

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);
  const key = JSON.stringify([term, kind, range, page]);

  const load = useCallback(() => api.unverified({ q: term, kind, from: range.from, to: range.to, limit: size, offset: page * size })
    .then((d) => { setData(d); setError(null); })
    .catch((e) => setError(e.message)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  usePulse(load);

  const t = data?.totals;
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const canRecheck = can(me, 'destinations.manage');

  return (
    <Shell title="Unverified vehicles"
      subtitle={data ? `${number(t.passes)} passes the register could not vouch for · ${dayLabel(data.period.from)} – ${dayLabel(data.period.to)}` : 'Vehicles whose type was declared at the gate'}>
      {error && <Banner tone="wrong" className="mb-4">{error}</Banner>}
      {notice && <Banner tone="good" className="mb-4">{notice}</Banner>}
      {!data && !error && <Loading rows={4} />}

      {data && (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Passes', number(t.passes), 'text-ink', 'In the period'],
              ['Type declared', number(t.declared), 'text-watch-700', 'Register had nothing'],
              ['No number plate', number(t.noPlate), 'text-wrong-700', 'Identified by hand'],
              ['Value', rupees(t.value), 'text-ink', 'Sold at declared prices'],
              ['Entered', number(t.entered), 'text-good-700', 'Actually came through'],
            ].map(([label, value, tone, hint]) => (
              <div key={label} className="card p-4">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
                <div className={`tabular mt-1.5 text-2xl font-bold leading-none ${tone}`}><Rolling text={String(value)} /></div>
                <div className="mt-2 text-2xs text-muted">{hint}</div>
              </div>
            ))}
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink">Day by day</h2>
              <p className="text-2xs text-muted">A quiet trickle is ordinary; a jump is worth asking about</p>
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#e4eaea" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(d) => d.slice(8)} tickLine={false} axisLine={false} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fill: '#6b7f80', fontSize: 11 }} />
                    <Tooltip labelFormatter={dayLabel} contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', fontSize: 13 }} />
                    <Area type="monotone" dataKey="passes" name="Unverified" stroke="#e08700" fill="#e0870022" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-2.5">
                <h2 className="text-sm font-semibold text-ink">Who declared them</h2>
                <p className="text-2xs text-muted">Against everything else they sold on the spot</p>
              </div>
              {data.byStaff.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Nobody has declared a vehicle type in this period.</p>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-line">
                    {data.byStaff.map((s) => (
                      <tr key={s.id}>
                        <td className="td text-sm text-ink">{s.name}</td>
                        <td className="td tabular text-right text-sm">{number(s.declared)} of {number(s.sold)}</td>
                        <td className="td text-right">
                          <span className={`chip ${s.share >= 50 ? 'bg-wrong-50 text-wrong-700' : s.share >= 25 ? 'bg-watch-50 text-watch-700' : 'bg-shell text-muted'}`}>
                            {s.share}%
                          </span>
                        </td>
                        <td className="td tabular text-right text-2xs text-muted">{rupees(s.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.byType.length > 0 && (
                <p className="border-t border-line px-4 py-2.5 text-2xs text-muted">
                  By type: {data.byType.filter((x) => x.passes).map((x) => `${x.label} ${number(x.passes)}`).join(' · ') || 'none'}
                </p>
              )}
            </div>
          </div>

          <section>
            <div className="card mb-3 grid gap-3 p-4 xl:grid-cols-[2fr_1fr_auto_auto]">
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Plate, chassis or other identification, pass number, visitor or mobile" />
              <select className="input" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }} aria-label="Kind">
                <option value="">Both kinds</option>
                <option value="declared">Type declared</option>
                <option value="no_plate">No number plate</option>
              </select>
              <input type="date" className="input" value={range.from} aria-label="From"
                onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPage(0); }} />
              <input type="date" className="input" value={range.to} min={range.from || undefined} aria-label="To"
                onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPage(0); }} />
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full min-w-[1040px]">
                <thead className="border-b border-line bg-shell">
                  <tr>
                    <th className="th">Pass</th><th className="th">Vehicle</th><th className="th">Identified by</th>
                    <th className="th">Sold as</th><th className="th">Visit</th><th className="th text-right">Amount</th>
                    <th className="th">Sold by</th><th className="th text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.passes.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                      Nothing here — every pass in this period rests on the vehicle register.
                    </td></tr>
                  )}
                  {data.passes.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="td">
                        <div className="font-mono text-sm text-ink">{p.ticketNo}</div>
                        <div className="text-2xs text-muted">{p.invoiceNo || 'no invoice'}</div>
                      </td>
                      <td className="td">
                        <div className="font-mono text-sm">{p.kind === 'no_plate' ? <span className="text-muted">{p.regNo}</span> : plate(p.regNo)}</div>
                        <span className={`chip ${KIND_TONE[p.kind]}`}>{p.kindLabel}</span>
                      </td>
                      <td className="td">
                        {p.identity ? (
                          <>
                            <div className="text-2xs text-muted">{IDENTITY_LABEL[p.identity.kind] || 'Note'}</div>
                            <div className="font-mono text-sm text-ink">{p.identity.value}</div>
                          </>
                        ) : <span className="text-2xs text-wrong-700">nothing recorded</span>}
                        <div className="text-2xs text-muted">{p.mobile}</div>
                        {/* The photograph is the one description of the vehicle
                            nobody typed, so it sits on the row beside what was. */}
                        {p.photos?.length > 0 && <Thumbs photos={p.photos} />}
                      </td>
                      <td className="td"><div className="text-sm text-ink">{p.type}</div><div className="text-2xs text-muted">{p.declaredClass}</div></td>
                      <td className="td"><div className="whitespace-nowrap text-sm">{dayLabel(p.travelDate)}</div><div className="text-2xs text-muted">{p.slot}</div></td>
                      <td className="td tabular text-right"><div className="font-semibold text-ink">{rupees(p.amount)}</div><div className="text-2xs text-muted">{p.paymentMethod || '—'}</div></td>
                      <td className="td">
                        <div className="text-sm">{p.soldBy || '—'}</div>
                        <div className="text-2xs text-muted">{p.soldAtGate || ''}{p.soldAt ? ` · ${when(p.soldAt)}` : ''}</div>
                      </td>
                      <td className="td text-right">
                        {canRecheck && p.kind === 'declared' && (
                          <button type="button" className="btn-quiet !px-2.5 !py-1 text-2xs" onClick={() => setChecking(p)}>Check register</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.total > 0 && (
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
          </section>
        </div>
      )}

      {checking && (
        <RecheckDialog pass={checking} onClose={() => setChecking(null)}
          onDone={(out) => { setChecking(null); setNotice(out.message); load(); }} />
      )}
    </Shell>
  );
}

function RecheckDialog({ pass, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Ask the vehicle register again" subtitle={plate(pass.regNo)} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy || !reasonOk(reason)}
          onClick={async () => { const out = await run(() => api.recheckVehicle(pass.regNo, reason)); if (out) onDone(out); }}>
          {busy ? 'Asking…' : 'Check now'}
        </button>
      </>}>
      <p className="text-sm text-body">
        A temporary registration becomes a permanent one, and a register that was unreachable comes back. This asks again, now.
        It was sold as <b>{pass.type}</b>; if the register disagrees, that is worth knowing.
      </p>
      <p className="text-2xs text-muted">A look-up costs money, which is why this is a button rather than something that runs on its own.</p>
      <Reason value={reason} onChange={setReason} placeholder="e.g. Checking the TR vehicles sold last week" />
      {error && <Banner tone="wrong">{error}</Banner>}
    </Modal>
  );
}
