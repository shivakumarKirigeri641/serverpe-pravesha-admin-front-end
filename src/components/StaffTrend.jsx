import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { dayLabel, number } from '../lib/format';
import { Banner, Loading } from './ui.jsx';

/*
 * Each staff member over time, rather than as one figure for a whole range.
 *
 * The table above says what somebody did across the range, which hides what is
 * worth seeing: a person getting quicker as they learn the app, a day when every
 * check took twice as long because the queue was in the rain, somebody who was
 * on the gate for three days and not since.
 *
 * TWO LINES OF QUESTIONING, TWO CHARTS. How many vehicles each person admitted,
 * and how long their checks took. They answer different questions and share an
 * axis in neither, so they are drawn apart.
 */
const COLOURS = ['#00a884', '#075e54', '#e08700', '#2f6fe4', '#b42318', '#6b7f80', '#7c3aed', '#0f766e'];

export default function StaffTrend({ range }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.analyticsStaffTrend(range)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [range.from, range.to]);

  if (error) return <Banner tone="wrong">{error}</Banner>;
  if (!data) return <Loading rows={3} />;
  if (!data.staff.length || !data.entries.length) {
    return <div className="card px-5 py-10 text-center text-sm text-muted">Nobody checked a vehicle in this range, so there is nothing to plot.</div>;
  }

  const single = data.entries.length === 1;

  return (
    <div className="space-y-4">
      {single && (
        <Banner>One day in this range has checks. Choose a longer range to see how each person changes over time.</Banner>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Chart title="Vehicles admitted each day" rows={data.entries} staff={data.staff}
          format={(v) => number(v)} />
        <Chart title="Average time to check a pass" rows={data.seconds} staff={data.staff}
          format={(v) => `${v} sec`} unit=" sec" />
      </div>
      <p className="text-2xs text-muted">
        Time is measured by the gate app, from opening a pass to recording the entry — a phone left open on a pass is not counted.
        A gap in a line is a day that person was not on the gate.
      </p>
    </div>
  );
}

function Chart({ title, rows, staff, format, unit = '' }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{title}</div>
      <div className="h-64 px-2 pb-2 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#e4eaea" vertical={false} />
            <XAxis dataKey="day" tickFormatter={(d) => String(d).slice(8)} tickLine={false} axisLine={false}
              tick={{ fill: '#6b7f80', fontSize: 11 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: '#6b7f80', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #e4eaea', boxShadow: '0 12px 32px rgba(15,26,28,.12)', fontSize: 13 }}
              labelFormatter={dayLabel}
              formatter={(v, name) => [v === null || v === undefined ? '—' : `${format(v)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#6b7f80' }} />
            {staff.map((s, i) => (
              <Line key={s.id} type="monotone" dataKey={s.name} stroke={COLOURS[i % COLOURS.length]} strokeWidth={2}
                dot={{ r: 2 }} connectNulls={false} unit={unit} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
