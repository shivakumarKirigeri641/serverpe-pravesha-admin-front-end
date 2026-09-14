import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell.jsx';
import Explain from '../components/Explain.jsx';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { Banner, Loading, LoadingTable } from '../components/ui.jsx';

/*
 * Coming up — how full the days ahead already are.
 *
 * WHAT IT ANSWERS. Every other screen looks at today, or at what has already
 * happened. This one answers the question asked on a Thursday afternoon: what
 * does the coming fortnight look like? A long weekend already sold out needs
 * staff rostered and the road people told; a Wednesday sitting at a tenth of
 * its places is worth a post.
 *
 * ONE ROW A DAY, READ DOWN. The fill bar is there so the shape of the fortnight
 * is seen before a single number is read — the busy days are the dark ones.
 * Opening a row shows the same day split by vehicle type, because "full" for
 * Tempo Travellers and "full" for two-wheelers are different problems.
 *
 * NOTHING IS CHANGED HERE. Today's places are changed on live monitoring, and
 * any other date in settings. This screen only looks.
 */

const RANGES = [[7, 'This week'], [14, 'Two weeks'], [21, 'Three weeks'], [28, 'Four weeks']];

const dayName = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/* Full is red, busy amber, quiet green — the same colours the rest of the panel
   uses. Written out in full: Tailwind only keeps classes it can see as text. */
function toneOf(pct) {
  if (pct === null) return 'bg-line';
  if (pct >= 95) return 'bg-wrong-500';
  if (pct >= 75) return 'bg-watch-500';
  if (pct >= 40) return 'bg-brand';
  return 'bg-good-500';
}

function Fill({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[80px] overflow-hidden rounded-full bg-shell">
        <div className={`h-full rounded-full ${toneOf(pct)} transition-[width] duration-500`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
      </div>
      <span className="tabular w-10 shrink-0 text-right text-2xs font-semibold text-ink">{pct === null ? '—' : `${pct}%`}</span>
    </div>
  );
}

export default function Outlook() {
  const [days, setDays] = useState(21);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api.outlook({ days })); setError(null); } catch (e) { setError(e.message); }
  }, [days]);
  useEffect(() => { setData(null); load(); }, [load]);

  const t = data?.totals;
  const slotNames = data?.days.find((d) => d.slots.length)?.slots.map((s) => String(s.label).split(/\s+/)[0]) || [];

  return (
    <Shell
      title="Coming up"
      subtitle={data?.place ? `${data.place.name} · ${dayName(data.from)} – ${dayName(data.to)}` : 'The days ahead, at a glance'}
      actions={(
        <div className="flex gap-1.5">
          {RANGES.map(([n, label]) => (
            <button key={n} type="button" className={`btn-quiet tap !px-3 !py-1.5 text-2xs ${days === n ? '!border-brand !text-brand' : ''}`}
              onClick={() => setDays(n)}>{label}</button>
          ))}
        </div>
      )}
    >
      <div className="page-in space-y-5">
        {error && <Banner tone="wrong">{error}</Banner>}

        <Banner>
          Passes already paid for, against the places each day has. Today's places are changed on <b>Live monitoring</b>;
          any other date in <b>Settings → Slots</b>. Nothing on this screen changes anything.
        </Banner>

        {!data ? (
          <>
            <Loading rows={0} head={4} />
            <LoadingTable rows={8} columns={6} />
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Figure label="Booked" value={number(t.booked)} sub={`of ${number(t.capacity)} places`} term="total booked" />
              <Figure label="How full" value={t.occupancy === null ? '—' : `${t.occupancy}%`} sub={`${number(t.remaining)} still to sell`} />
              <Figure label="Busiest day" value={t.busiest ? `${t.busiest.occupancy}%` : '—'} sub={t.busiest ? dayName(t.busiest.day) : 'Nothing booked yet'} />
              <Figure label="Days nearly full" value={number(t.full)} sub="95% or more — roster for these" />
            </div>

            {t.categories.some((c) => c.booked > 0) && (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-shell">
                    <tr>
                      <th className="th">Vehicle type</th><th className="th text-right">Booked</th>
                      <th className="th text-right">Places</th><th className="th text-right">Left</th><th className="th w-48">How full</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {t.categories.map((c) => (
                      <tr key={c.code} className="row-hover">
                        <td className="td font-medium text-ink">{c.label}</td>
                        <td className="td tabular text-right font-semibold text-ink">{number(c.booked)}</td>
                        <td className="td tabular text-right text-muted">{number(c.capacity)}</td>
                        <td className="td tabular text-right">{number(c.remaining)}</td>
                        <td className="td"><Fill pct={c.occupancy} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-line bg-shell">
                  <tr>
                    <th className="th">Date</th>
                    {slotNames.map((name) => <th key={name} className="th text-right">{name}</th>)}
                    <th className="th text-right">Booked</th>
                    <th className="th text-right">Left</th>
                    <th className="th w-52">How full</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.days.map((d) => {
                    const isOpen = open === d.day;
                    return [
                      <tr key={d.day} className={`row-hover cursor-pointer ${d.isWeekend ? 'bg-shell/40' : ''}`}
                        onClick={() => setOpen(isOpen ? null : d.day)}>
                        <td className="td whitespace-nowrap">
                          <span className="font-medium text-ink">{dayName(d.day)}</span>
                          <span className={`ml-2 text-2xs ${d.isWeekend ? 'font-semibold text-brand' : 'text-muted'}`}>{d.weekdayName.slice(0, 3)}</span>
                          {d.isToday && <span className="chip ml-2 bg-brand/10 text-brand">Today</span>}
                          {d.anyClosed && <span className="chip ml-2 bg-wrong-50 text-wrong-700">Slot closed</span>}
                        </td>
                        {d.slots.map((s) => (
                          <td key={s.slotId} className="td tabular whitespace-nowrap text-right">
                            <span className={s.booked ? 'font-semibold text-ink' : 'text-muted'}>{number(s.booked)}</span>
                            <span className="text-2xs text-muted"> / {number(s.capacity)}</span>
                          </td>
                        ))}
                        <td className="td tabular text-right font-semibold text-ink">{number(d.booked)}</td>
                        <td className="td tabular text-right text-muted">{number(d.remaining)}</td>
                        <td className="td"><Fill pct={d.occupancy} /></td>
                      </tr>,
                      isOpen && (
                        <tr key={`${d.day}-open`} className="bg-shell/60">
                          <td className="td" colSpan={3 + d.slots.length}>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {d.slots.map((s) => (
                                <div key={s.slotId}>
                                  <div className="label !mb-2">{s.label} · {s.startsAt}–{s.endsAt}{!s.isOpen ? ' · closed' : ''}</div>
                                  <table className="w-full text-2xs">
                                    <tbody className="divide-y divide-line/70">
                                      {s.categories.map((c) => (
                                        <tr key={c.categoryId}>
                                          <td className="py-1.5 pr-3 text-body">{c.label}</td>
                                          <td className="tabular py-1.5 pr-3 text-right font-semibold text-ink">{number(c.booked)}</td>
                                          <td className="tabular py-1.5 pr-3 text-right text-muted">of {number(c.capacity)}</td>
                                          <td className="w-24 py-1.5"><Fill pct={c.occupancy} /></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-2xs text-muted">A row opens to show the same day split by vehicle type. Weekends are shaded.</p>
          </>
        )}
      </div>
    </Shell>
  );
}

function Figure({ label, value, sub, term }) {
  return (
    <div className="card card-hover px-4 py-3">
      <div className="label !mb-1"><Explain term={term || label}>{label}</Explain></div>
      <div className="tabular text-2xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-2xs text-muted">{sub}</div>
    </div>
  );
}
