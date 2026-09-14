import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { number } from '../lib/format';
import { Banner, Loading } from './ui.jsx';

/*
 * When vehicles actually come: every hour of every day of the week, in one grid.
 *
 * WHY A GRID AND NOT TWO CHARTS. "Busiest at eleven" and "busiest on Sunday" are
 * each half an answer. The half that plans a rota or a slot's capacity is
 * "Sunday at eleven", and only a grid says that without arithmetic.
 *
 * THE AVERAGE, NOT THE TOTAL. Thirty days holds four Sundays and five Mondays,
 * so totals quietly make Monday look busier. Each cell is the average for that
 * weekday and hour; the total is on the tooltip for anybody who wants it.
 *
 * QUIET HOURS ARE DROPPED. Gates run from six to six; twenty-four columns of
 * mostly nothing makes the busy ones unreadable, so the grid covers the hours
 * that have ever seen an entry, with a little room either side.
 */
export default function Patterns({ range }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.analyticsPatterns(range)
      .then((d) => { if (alive) { setData(d.heatmap); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [range.from, range.to]);

  if (error) return <Banner tone="wrong">{error}</Banner>;
  if (!data) return <Loading rows={4} />;
  if (!data.total) {
    return <div className="card px-5 py-12 text-center text-sm text-muted">No entries were recorded in this range, so there is no pattern to show yet.</div>;
  }

  /* The hours worth drawing: from the first with any entry to the last. */
  const active = data.byHour.filter((h) => h.entries > 0).map((h) => h.hour);
  const first = Math.max(0, Math.min(...active) - 1);
  const last = Math.min(23, Math.max(...active) + 1);
  const hours = [];
  for (let h = first; h <= last; h += 1) hours.push(h);

  const shade = (average) => {
    if (!average) return { background: 'transparent' };
    const strength = Math.min(1, average / (data.maxAverage || 1));
    /* One colour, deepening — a rainbow scale invents categories that are not there. */
    return { background: `rgba(0, 168, 132, ${0.10 + strength * 0.75})`, color: strength > 0.55 ? '#fff' : undefined };
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Busiest hour of the week" value={data.busiest ? `${data.busiest.day}, ${data.busiest.label}` : '—'}
          sub={data.busiest ? `${number(data.busiest.entries)} entries · ${data.busiest.average} on an average ${data.busiest.day}` : null} />
        <Figure label="Busiest day" value={data.busiestDay ? data.busiestDay.day : '—'}
          sub={data.busiestDay ? `${number(data.busiestDay.entries)} entries across ${number(data.busiestDay.days)} of them` : null} />
        <Figure label="Entries in this range" value={number(data.total)} sub="Recorded at a gate" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="th text-left">Day</th>
              {hours.map((h) => (
                <th key={h} className="th px-1 text-center text-2xs">{((h + 11) % 12) + 1}{h < 12 ? 'a' : 'p'}</th>
              ))}
              <th className="th text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.rows.map((r) => (
              <tr key={r.dow}>
                <td className="td whitespace-nowrap font-medium text-ink">
                  {r.day}
                  <span className="ml-1 text-2xs text-muted">×{number(r.days)}</span>
                </td>
                {hours.map((h) => {
                  const cell = r.hours[h];
                  return (
                    <td key={h} className="tabular px-1 py-1.5 text-center text-2xs" style={shade(cell.average)}
                      title={`${r.day} ${cell.label}: ${number(cell.entries)} entries in this range, ${cell.average} on an average ${r.day}`}>
                      {cell.average ? cell.average : ''}
                    </td>
                  );
                })}
                <td className="td tabular text-right font-semibold text-ink">{number(r.entries)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-2xs text-muted">
        Each cell is the average number of vehicles admitted in that hour on that day of the week, across this range — ×n says how many
        of that weekday the range holds. Hover a cell for the total. Deeper colour means busier.
      </p>
    </div>
  );
}

const Figure = ({ label, value, sub }) => (
  <div className="card p-4">
    <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</div>
    <div className="mt-1 text-xl font-bold text-ink">{value}</div>
    {sub && <div className="mt-1 text-2xs text-muted">{sub}</div>}
  </div>
);
