/**
 * Analytics — the questions the department has never been able to answer.
 *
 * Not "how much did we collect", which the reports already say, but: who comes,
 * how often, at what hour, how far ahead they book, and whether anybody comes
 * back. None of that exists under a paper ticket, and it is the part of this
 * system that outlives the fraud problem it was built for.
 *
 * ON THE CHARTS: one colour family throughout, because these are quantities of
 * the same thing rather than competing categories. Red appears only where it
 * means a refusal. Every axis is labelled in rupees or counts — never a bare
 * number whose unit the reader has to infer.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, daysAgo, today } from '../lib/format';
import { PageHead, Section, Stat, Loading, Field } from '../components/ui';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

/* One hue, stepped. These are quantities of one thing, not rival categories. */
const RAMP = ['#0b3f39', '#0f766e', '#19a396', '#5cc4b8', '#9ddbd2'];
const GRID = '#e6eae8';
const AXIS = { fontSize: 11, fill: '#6b7975' };
const TIP = { fontSize: 12, borderRadius: 8, border: '1px solid #c2ccc8' };

const PRESETS = [['7 days', 7], ['30 days', 30], ['90 days', 90], ['This year', 365]];

export default function Analytics() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api.get(`/analytics?from=${from}&to=${to}`, { quiet: true }).then(setD);
  }, [from, to]);

  return (
    <>
      <PageHead title="Analytics"
                subtitle={`${shortDate(from)} to ${shortDate(to)}`}>
        {PRESETS.map(([label, days]) => (
          <button key={days} className="btn-ghost !py-1.5"
                  onClick={() => { setFrom(daysAgo(days)); setTo(today()); }}>
            {label}
          </button>
        ))}
      </PageHead>

      <Section className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <input type="date" className="input" value={from}
                   onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={to}
                   onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Section>

      {!d ? <Loading what="Working out the numbers" /> : <Charts d={d} />}
    </>
  );
}

function Charts({ d }) {
  const s = d.summary || {};
  const arrival = d.byHour.filter((h) => h.scans > 0);
  const entered = s.entered || 0;
  const conversion = s.tickets ? Math.round((entered / s.tickets) * 100) : 0;

  return (
    <>
      {/* The headline counts */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat label="Tickets" value={num(s.tickets)}
              hint={`${num(s.postponed)} moved to another day`} />
        <Stat label="Vehicles entered" value={num(entered)} tone="allowed"
              hint={`${conversion}% of tickets used`} />
        <Stat label="Distinct visitors" value={num(s.customers)}
              hint={`${num(s.vehicles)} distinct vehicles`} />
        <Stat label="Collected" value={rupees(s.gross_paise)}
              hint={`Average ticket ${rupees(s.avg_ticket_paise)}`} />
        <Stat label="To the department" value={rupees(s.entry_paise)}
              hint={`Service fee ${rupees(s.fee_paise)}`} />
      </div>

      {/* The season, day by day */}
      <Section title="Tickets and entries, day by day"
               note="Booked against actually arrived. The gap is people who did not come."
               className="mb-5">
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.daily.map((x) => ({
              date: shortDate(x.date).replace(', ', ' '),
              Booked: x.tickets, Entered: x.entered,
            }))}>
              <defs>
                <linearGradient id="gBooked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RAMP[2]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={RAMP[2]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false}
                     axisLine={{ stroke: GRID }} minTickGap={20} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={TIP} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Booked" stroke={RAMP[2]} strokeWidth={2}
                    fill="url(#gBooked)" />
              <Line type="monotone" dataKey="Entered" stroke={RAMP[0]} strokeWidth={2}
                    dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* When they actually turn up */}
        <Section title="When vehicles arrive"
                 note="Scans by hour of day — the number that decides where the slot boundary belongs.">
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arrival.map((h) => ({
                hour: `${h.hour}:00`, Entered: h.entered, Refused: h.scans - h.entered,
              }))}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="hour" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={TIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entered" stackId="a" fill={RAMP[1]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Refused" stackId="a" fill="#b91c1c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!arrival.length && (
            <p className="text-center text-sm text-ink-500 -mt-40 pb-40">No scans yet.</p>
          )}
        </Section>

        {/* Which day of the week */}
        <Section title="Busiest days"
                 note="Tickets by day of the week across the whole period.">
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byWeekday.map((w) => ({ day: w.short, Tickets: w.tickets }))}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={TIP} />
                <Bar dataKey="Tickets" radius={[4, 4, 0, 0]}>
                  {d.byWeekday.map((w, i) => (
                    <Cell key={i} fill={w.dow === 0 || w.dow === 6 ? RAMP[1] : RAMP[3]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-2xs text-ink-500 mt-1">Weekends in the darker shade.</p>
        </Section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* What comes up the hill */}
        <Section title="By vehicle type" note="Share of all tickets.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.categories.map((c) => ({ name: c.label, value: c.tickets }))}
                     dataKey="value" nameKey="name" innerRadius="52%" outerRadius="80%"
                     paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {d.categories.map((_, i) => <Cell key={i} fill={RAMP[i % RAMP.length]} />)}
                </Pie>
                <Tooltip contentStyle={TIP} formatter={(v, n) => [`${num(v)} tickets`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* How far ahead */}
        <Section title="How far ahead they book"
                 note="Whether the booking window is doing any work.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="25%" outerRadius="95%" startAngle={90} endAngle={-270}
                              data={d.leadTime.map((l, i) => ({
                                name: l.bucket, value: l.tickets, fill: RAMP[i % RAMP.length],
                              }))}>
                <RadialBar background dataKey="value" cornerRadius={4} />
                <Tooltip contentStyle={TIP} formatter={(v, n, p) => [`${num(v)} tickets`, p.payload.name]} />
                <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right"
                        wrapperStyle={{ fontSize: 10.5 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Do they come back */}
        <Section title="Do visitors return?"
                 note="Something a paper ticket could never tell the department.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.repeatVisitors.map((r) => ({ name: r.bucket, value: r.customers }))}
                     dataKey="value" nameKey="name" innerRadius="52%" outerRadius="80%"
                     paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {d.repeatVisitors.map((_, i) => <Cell key={i} fill={RAMP[i % RAMP.length]} />)}
                </Pie>
                <Tooltip contentStyle={TIP} formatter={(v, n) => [`${num(v)} visitors`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* New against returning */}
        <Section title="New visitors against returning"
                 note="By week. A rising returning line is the healthiest thing on this page.">
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.newVsReturning.map((w) => ({
                week: shortDate(w.week).replace(', ', ' '),
                'First visit': w.first_time, Returning: w.returning,
              }))}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="week" tick={AXIS} tickLine={false}
                       axisLine={{ stroke: GRID }} minTickGap={16} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={TIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="First visit" stackId="a" fill={RAMP[3]} />
                <Bar dataKey="Returning" stackId="a" fill={RAMP[0]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* How full */}
        <Section title="How full the site runs"
                 note="Booked against capacity, per day.">
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.occupancy.map((o) => ({
                date: shortDate(o.date).replace(', ', ' '), Occupancy: o.pct,
              }))}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false}
                       axisLine={{ stroke: GRID }} minTickGap={20} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40}
                       domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={TIP} formatter={(v) => [`${v}% full`, 'Occupancy']} />
                <Line type="monotone" dataKey="Occupancy" stroke={RAMP[1]} strokeWidth={2}
                      dot={{ r: 2.5, fill: RAMP[1] }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {d.bookingToEntry?.n > 0 && (
            <p className="text-2xs text-ink-500 mt-2">
              Median time from booking to arriving at the gate:{' '}
              <b className="text-ink-800">{d.bookingToEntry.median_hours} hours</b>{' '}
              (average {d.bookingToEntry.avg_hours}), across {num(d.bookingToEntry.n)} entries.
            </p>
          )}
        </Section>
      </div>
    </>
  );
}
