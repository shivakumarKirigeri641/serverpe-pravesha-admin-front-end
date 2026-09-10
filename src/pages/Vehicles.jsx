/**
 * Every vehicle, and how many times it has come up the hill.
 *
 * The count is the point. A vehicle with eleven entries this season is a fact
 * the department has never been able to establish, and it is the row that
 * answers two different questions at once: which commercial vehicles are
 * working the route, and whether one registration is being used in a way it
 * should not be.
 *
 * "Booked by" is the quietly useful column. A vehicle booked by three different
 * mobile numbers is either a shared family car or something worth a look.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, when, plate, verdict, toneClass, TICKET_STATUS } from '../lib/format';
import { PageHead, Section, Table, Pill, Loading, Drawer, Field } from '../components/ui';

const SORTS = [
  ['visits', 'Most visits'],
  ['recent', 'Most recent'],
  ['plate', 'Registration number'],
];

export default function Vehicles() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('visits');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);

  async function load(query = q) {
    setData(null);
    const qs = new URLSearchParams({ sort, ...(query ? { q: query } : {}) });
    setData(await api.get(`/vehicles?${qs}`, { quiet: true }));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sort]);

  async function openRow(row) {
    setOpen(row); setDetail(null);
    setDetail(await api.get(`/vehicles/${row.reg_no}`, { quiet: true }));
  }

  const t = data?.totals || {};

  return (
    <>
      <PageHead
        title="Vehicles"
        subtitle={data ? `${num(t.vehicles)} distinct vehicles · ${num(t.visits)} visits` : ' '}
      />

      <Section className="mb-5">
        <form className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Field label="Registration number">
            <input className="input min-w-[16rem]" value={q}
                   onChange={(e) => setQ(e.target.value)} placeholder="KA31N8147" />
          </Field>
          <Field label="Order by">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <button className="btn-primary">Search</button>
        </form>
      </Section>

      <Section>
        {!data ? <Loading what="Loading vehicles" /> : (
          <Table
            onRowClick={openRow}
            columns={[
              { key: 'reg_no', label: 'Vehicle',
                render: (r) => (
                  <div>
                    <div className="font-medium">{plate(r.reg_no)}</div>
                    <div className="text-2xs text-ink-500">
                      {[r.maker, r.model].filter(Boolean).join(' ') || r.vehicle_class || '—'}
                    </div>
                  </div>
                ) },
              { key: 'category_label', label: 'Type' },
              { key: 'visits', label: 'Visits', align: 'right',
                render: (r) => (
                  <span className={r.visits >= 5 ? 'font-semibold text-forest-700' : ''}>
                    {num(r.visits)}
                  </span>
                ) },
              { key: 'entered', label: 'Entered', align: 'right',
                render: (r) => num(r.entered) },
              { key: 'booked_by', label: 'Booked by', align: 'right',
                render: (r) => r.booked_by > 1
                  ? <span className="text-pending font-semibold">{num(r.booked_by)} numbers</span>
                  : <span className="text-ink-500">1 number</span> },
              { key: 'spend_paise', label: 'Total paid', align: 'right',
                render: (r) => rupees(r.spend_paise) },
              { key: 'first_visit', label: 'First', render: (r) => shortDate(r.first_visit) },
              { key: 'last_visit', label: 'Last', render: (r) => shortDate(r.last_visit) },
            ]}
            rows={data.rows}
            empty="No vehicles match that search."
          />
        )}
      </Section>

      <Drawer open={!!open} title={open ? plate(open.reg_no) : ''} onClose={() => setOpen(null)}>
        {!detail ? <Loading what="Loading history" /> : (
          <div className="space-y-5">
            <div className="card p-4">
              <div className="text-xl font-semibold">{plate(detail.vehicle.reg_no)}</div>
              <div className="text-sm text-ink-500 mt-0.5">
                {[detail.vehicle.maker, detail.vehicle.model].filter(Boolean).join(' ')
                  || detail.vehicle.vehicle_class || 'Type not looked up'}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {[
                  ['Fuel', detail.vehicle.fuel],
                  ['Colour', detail.vehicle.colour],
                  ['Class', detail.vehicle.vehicle_class],
                  ['Registered', detail.vehicle.registered_at],
                  ['Registration date', detail.vehicle.reg_date
                    ? shortDate(detail.vehicle.reg_date) : null],
                  ['Seats', detail.vehicle.seats],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <dt className="label">{k}</dt>
                    <dd className="mt-0.5 text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-2xs text-ink-500">
                Owner name, address, chassis and engine number are never stored.
              </p>
            </div>

            <div className="card p-4">
              <div className="label mb-2">Every visit ({num(detail.visits.length)})</div>
              <ul className="divide-y divide-ink-300/40">
                {detail.visits.map((v) => {
                  const st = TICKET_STATUS[v.status] || { label: v.status, tone: 'muted' };
                  return (
                    <li key={v.ticket_no} className="py-2.5 first:pt-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm">
                          <span className="font-mono text-xs">{v.ticket_no}</span>
                          <span className="ml-2">{shortDate(v.travel_date)}</span>
                        </div>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                      <div className="mt-0.5 text-2xs text-ink-500">
                        {v.slot_label} · {rupees(v.total_paise)}
                        {v.used_at && ` · entered ${when(v.used_at)}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {detail.scans.length > 0 && (
              <div className="card p-4">
                <div className="label mb-2">Gate history</div>
                <ul className="space-y-2">
                  {detail.scans.map((s, i) => {
                    const v = verdict(s.verdict);
                    return (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`pill ${toneClass(v.tone)}`}>{v.label}</span>
                          <div className="text-2xs text-ink-500 mt-1">
                            {s.staff_name || 'unknown staff'}
                            {s.ticket_no && ` · ${s.ticket_no}`}
                          </div>
                        </div>
                        <div className="text-2xs text-ink-500 whitespace-nowrap">
                          {when(s.scanned_at)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
