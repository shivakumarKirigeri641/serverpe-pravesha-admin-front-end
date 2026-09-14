import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { Banner, Loading, LoadingTable } from './ui.jsx';
import Explain from './Explain.jsx';

/*
 * Where they come from — the state and the registering office on every plate
 * that reached the barrier.
 *
 * WHAT IT IS FOR. This is the tourism question, not the operations one: is
 * Mullayanagiri a Bengaluru weekend or a Karnataka one, is there enough Kerala
 * and Tamil Nadu traffic to be worth a notice in those languages, which
 * districts are worth advertising in. Every answer is already printed on the
 * vehicles coming up the hill.
 *
 * COUNTED BY VEHICLE, NOT BY ENTRY. A Tempo Traveller that comes nine times in
 * a month is one Bengaluru vehicle. Counting each arrival would make the near
 * districts look bigger than they are, so the figures are distinct vehicles,
 * with total arrivals beside them.
 *
 * WHAT IS CERTAIN AND WHAT IS NOT, SAID PLAINLY. The state is the first two
 * letters of the plate and is never in doubt. The office is from the vehicle's
 * registration certificate, and where we have not fetched one the bare RTO code
 * is shown rather than a guess.
 */

const BARS = [
  'bg-brand', 'bg-brand-light', 'bg-brand-accent', 'bg-good-500',
  'bg-watch-500', 'bg-muted', 'bg-ink/60', 'bg-line',
];

function Bar({ share, tone = 'bg-brand' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[70px] overflow-hidden rounded-full bg-shell">
        <div className={`h-full rounded-full ${tone} transition-[width] duration-700`} style={{ width: `${Math.min(100, share)}%` }} />
      </div>
      <span className="tabular w-12 shrink-0 text-right text-2xs font-semibold text-ink">{share}%</span>
    </div>
  );
}

export default function Origins({ range }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [allPlaces, setAllPlaces] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.analyticsOrigins(range)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [range.from, range.to]);

  if (error) return <Banner tone="wrong">{error}</Banner>;
  if (!data) {
    return (
      <div className="space-y-5">
        <Loading rows={0} head={4} />
        <LoadingTable rows={6} columns={4} />
      </div>
    );
  }

  if (data.vehicles === 0) {
    return <div className="card px-5 py-12 text-center text-sm text-muted">No vehicles came through a gate in this period.</div>;
  }

  const places = allPlaces ? data.places : data.places.slice(0, 15);
  const unnamed = data.vehicles - data.named;

  return (
    <div className="page-in space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="Vehicles" value={number(data.vehicles)} sub={`${number(data.entries)} arrivals between them`} term="vehicles counted" />
        <Figure label="Home state" value={data.home ? data.home.name : '—'} sub={data.home ? `${data.home.share}% of vehicles` : ''} small />
        <Figure label="From elsewhere" value={number(data.fromOutside)}
          sub={`${data.vehicles ? Math.round((data.fromOutside / data.vehicles) * 100) : 0}% from another state or UT`} term="from elsewhere" />
        <Figure label="States and UTs" value={number(data.states.length)} sub="with at least one vehicle" />
      </div>

      {/* ── by state ───────────────────────────────────────────────────── */}
      <div className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">By state and union territory</h2>
          <p className="text-2xs text-muted">From the first two letters of the number plate, which never change.</p>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">State / UT</th><th className="th">Code</th>
              <th className="th text-right">Vehicles</th><th className="th text-right">Arrivals</th><th className="th w-56">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.states.map((s, i) => (
              <tr key={s.code} className="row-hover">
                <td className="td font-medium text-ink">
                  {s.name}
                  {s.kind === 'ut' && <span className="chip ml-2 bg-shell text-muted">Union territory</span>}
                  {s.kind === 'series' && <span className="chip ml-2 bg-shell text-muted">No single state</span>}
                  {i === 0 && <span className="chip ml-2 bg-brand/10 text-brand">Most</span>}
                </td>
                <td className="td font-mono text-muted">{s.code}</td>
                <td className="td tabular text-right font-semibold text-ink">{number(s.vehicles)}</td>
                <td className="td tabular text-right text-muted">{number(s.entries)}</td>
                <td className="td"><Bar share={s.share} tone={BARS[Math.min(i, BARS.length - 1)]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── by registering office ──────────────────────────────────────── */}
      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">By district and registering office</h2>
            <p className="text-2xs text-muted">
              From each vehicle's registration certificate.
              {unnamed > 0 && ` For ${number(unnamed)} vehicle${unnamed === 1 ? '' : 's'} we have no certificate yet, so the code on the plate is shown instead.`}
            </p>
          </div>
          {data.places.length > 15 && (
            <button type="button" className="btn-quiet tap !px-3 !py-1.5 text-2xs" onClick={() => setAllPlaces((v) => !v)}>
              {allPlaces ? 'Show the top 15' : `Show all ${number(data.places.length)}`}
            </button>
          )}
        </div>
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Place</th><th className="th">State / UT</th>
              <th className="th text-right">Vehicles</th><th className="th text-right">Arrivals</th><th className="th w-56">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {places.map((p, i) => (
              <tr key={p.key} className="row-hover">
                <td className="td">
                  {p.named
                    ? <span className="font-medium text-ink">{p.place}</span>
                    : (
                      <span className="font-mono text-muted" title="No registration certificate fetched for these vehicles yet — this is the RTO code printed on the plate.">
                        {p.rtoCode} <span className="font-sans text-2xs">· office not known</span>
                      </span>
                    )}
                </td>
                <td className="td text-muted">{p.stateName}</td>
                <td className="td tabular text-right font-semibold text-ink">{number(p.vehicles)}</td>
                <td className="td tabular text-right text-muted">{number(p.entries)}</td>
                <td className="td"><Bar share={p.share} tone={BARS[Math.min(i, BARS.length - 1)]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-2xs text-muted">
        A vehicle is counted once however many times it came up. Arrivals count every admitted check.
      </p>
    </div>
  );
}

function Figure({ label, value, sub, term, small = false }) {
  return (
    <div className="card card-hover px-4 py-3">
      <div className="label !mb-1"><Explain term={term || label}>{label}</Explain></div>
      <div className={`tabular font-bold text-ink ${small ? 'text-lg' : 'text-2xl'}`}>{value}</div>
      <div className="mt-0.5 text-2xs text-muted">{sub}</div>
    </div>
  );
}
