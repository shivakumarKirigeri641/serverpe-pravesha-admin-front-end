/**
 * Every visitor, and how often they come.
 *
 * Sorted by ticket count rather than by recency, because the interesting rows
 * are at the top of that ordering: the person who has been eleven times is
 * either a taxi working the route or something worth knowing about, and today
 * nobody can see either.
 *
 * Opening a row is a look at one citizen's travel history. It is recorded in
 * the audit trail as one — that is what makes the privacy policy true rather
 * than merely stated.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num, shortDate, when, plate, TICKET_STATUS } from '../lib/format';
import { PageHead, Section, Table, Pill, Loading, Drawer, Field } from '../components/ui';

const SORTS = [
  ['tickets', 'Most visits'],
  ['spend', 'Highest spend'],
  ['recent', 'Most recent'],
];

export default function Customers({ admin }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('tickets');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);

  async function load(query = q) {
    setData(null);
    const qs = new URLSearchParams({ sort, ...(query ? { q: query } : {}) });
    setData(await api.get(`/customers?${qs}`, { quiet: true }));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sort]);

  async function openRow(row) {
    setOpen(row); setDetail(null);
    setDetail(await api.get(`/customers/${row.mobile}`, { quiet: true }));
  }

  const t = data?.totals || {};

  return (
    <>
      <PageHead
        title="Visitors"
        subtitle={data ? `${num(t.customers)} people · ${num(t.tickets)} tickets · ${rupees(t.spend_paise)} collected` : ' '}
      />

      <Section className="mb-5">
        <form className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Field label="Search" hint="Mobile number, name or a vehicle they booked">
            <input className="input min-w-[16rem]" value={q}
                   onChange={(e) => setQ(e.target.value)} placeholder="9886122415 or KA31N8147" />
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
        {!data ? <Loading what="Loading visitors" /> : (
          <Table
            onRowClick={openRow}
            columns={[
              { key: 'mobile', label: 'Visitor',
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.wa_profile_name || 'Unnamed'}</div>
                    <div className="font-mono text-2xs text-ink-500">{r.mobile}</div>
                  </div>
                ) },
              { key: 'tickets', label: 'Visits', align: 'right',
                render: (r) => (
                  <span className={r.tickets >= 5 ? 'font-semibold text-forest-700' : ''}>
                    {num(r.tickets)}
                  </span>
                ) },
              { key: 'entered', label: 'Entered', align: 'right',
                render: (r) => num(r.entered) },
              { key: 'vehicles', label: 'Vehicles', align: 'right',
                render: (r) => num(r.vehicles) },
              { key: 'spend_paise', label: 'Spent', align: 'right',
                render: (r) => rupees(r.spend_paise) },
              { key: 'to_department_paise', label: 'To department', align: 'right',
                render: (r) => <span className="text-forest-700">{rupees(r.to_department_paise)}</span> },
              { key: 'first_visit', label: 'First visit',
                render: (r) => shortDate(r.first_visit) },
              { key: 'last_visit', label: 'Last visit',
                render: (r) => shortDate(r.last_visit) },
              { key: 'is_internal', label: '',
                render: (r) => r.is_internal ? <Pill tone="muted">Internal</Pill> : null },
            ]}
            rows={data.rows}
            empty="No visitors match that search."
          />
        )}
      </Section>

      <Drawer open={!!open}
              title={open ? (open.wa_profile_name || open.mobile) : ''}
              onClose={() => setOpen(null)}>
        {!detail ? <Loading what="Loading history" /> : (
          <div className="space-y-5">
            <div className="card p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="label">Mobile</div>
                  <div className="font-mono mt-0.5">{detail.customer.mobile}</div>
                </div>
                <div>
                  <div className="label">First seen</div>
                  <div className="mt-0.5">{when(detail.customer.first_seen_at)}</div>
                </div>
                <div>
                  <div className="label">Tickets</div>
                  <div className="mt-0.5 text-lg font-semibold tnum">{num(detail.tickets.length)}</div>
                </div>
                <div>
                  <div className="label">Total spent</div>
                  <div className="mt-0.5 text-lg font-semibold tnum">
                    {rupees(detail.tickets.reduce((n, x) => n + x.total_paise, 0))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="label mb-2">Every visit</div>
              <ul className="divide-y divide-ink-300/40">
                {detail.tickets.map((x) => {
                  const st = TICKET_STATUS[x.status] || { label: x.status, tone: 'muted' };
                  return (
                    <li key={x.ticket_no} className="py-2.5 first:pt-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-medium">{plate(x.reg_no)}</div>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                      <div className="mt-0.5 text-2xs text-ink-500">
                        {shortDate(x.travel_date)} · {x.slot_label} · {x.category_label}
                        {' · '}{rupees(x.total_paise)}
                        {x.move_count > 0 && ` · moved ${x.move_count}×`}
                      </div>
                    </li>
                  );
                })}
                {!detail.tickets.length && (
                  <li className="py-4 text-sm text-ink-500">No tickets.</li>
                )}
              </ul>
            </div>

            {detail.events.length > 0 && (
              <div className="card p-4">
                <div className="label mb-2">Recorded activity</div>
                <ul className="space-y-1.5 text-2xs">
                  {detail.events.map((e, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="text-ink-700">{e.kind.replace(/_/g, ' ')}</span>
                      <span className="text-ink-500 whitespace-nowrap">{when(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
