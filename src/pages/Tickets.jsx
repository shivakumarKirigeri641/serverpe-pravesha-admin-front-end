/**
 * Every ticket issued, and what happened to it at the gate.
 *
 * A bookings list shows what was sold. This shows what happened afterwards,
 * which is a different question and the one that matters: a vehicle presented
 * three times, twice refused, looks entirely ordinary on a bookings list and is
 * the single most interesting row in the system.
 *
 * THIS WAS THE QR PAGE. Entry is no longer by scanned code — the staff member
 * reads the number plate and types it, and the gate looks the vehicle up. So
 * there is no image to render here and nothing on this screen is a credential
 * any more; what is left is the ticket, its state, and its history.
 *
 * The payment link is still withheld behind a setting, because a live checkout
 * URL is payable by anyone who photographs the screen.
 */

import { useEffect, useState } from 'react';
import { api, API_BASE, getToken } from '../lib/api';
import { rupees, num, shortDate, when, plate, verdict, toneClass } from '../lib/format';
import { PageHead, Section, Table, Pill, Loading, Drawer, Field } from '../components/ui';

const FILTERS = [
  ['all', 'All'],
  ['upcoming', 'Upcoming'],
  ['today', 'Today'],
  ['used', 'Used'],
  ['contested', 'Contested'],
  ['unused', 'Never used'],
  ['moved', 'Moved'],
  ['cancelled', 'Cancelled'],
];

export default function Tickets() {
  const [state, setState] = useState('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  async function load(query = q, s = state) {
    setData(null);
    const qs = new URLSearchParams({ ...(s !== 'all' ? { state: s } : {}), ...(query ? { q: query } : {}) });
    setData(await api.get(`/tickets?${qs}`, { quiet: true }));
  }

  useEffect(() => { load(q, state); /* eslint-disable-next-line */ }, [state]);

  const c = data?.counts || {};

  /* The ticket card as the visitor received it, fetched with the token so it
     cannot be a plain <img src>. Kept for support — when somebody rings to say
     their ticket looks wrong, this is what they are looking at. */
  const [card, setCard] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    let dead = false;
    let url;
    (async () => {
      const res = await fetch(`${API_BASE}/admin/api/tickets/${open.ticket_no}/card.png`,
        { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) return;
      url = URL.createObjectURL(await res.blob());
      if (!dead) setCard(url); else URL.revokeObjectURL(url);
    })();
    return () => { dead = true; if (url) URL.revokeObjectURL(url); setCard(null); };
  }, [open]);


  return (
    <>
      <PageHead title="Tickets"
                subtitle="Every ticket issued, its state, and every entry attempted against it." />

      {data?.show_qr && (
        <div className="card border-l-4 border-l-pending p-3.5 mb-5">
          <div className="text-sm font-semibold text-pending">
            Live payment links are visible in this panel
          </div>
          <p className="text-2xs text-ink-600 mt-0.5">
            A checkout link on a screen is payable by anyone who photographs it. Turn this off
            under Pricing &amp; settings (<span className="font-mono">show_qr_in_admin</span>)
            before real operation.
          </p>
        </div>
      )}

      {/* Counts double as filters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-5">
        {[
          ['upcoming', 'Upcoming', c.upcoming, 'forest'],
          ['today', 'Today', c.today, 'forest'],
          ['used', 'Used', c.used, 'allowed'],
          ['contested', 'Contested', c.contested, 'refused'],
          ['unused', 'Never used', c.unused, 'muted'],
          ['moved', 'Moved', c.moved, 'pending'],
          ['cancelled', 'Cancelled', c.cancelled, 'muted'],
        ].map(([key, label, n, tone]) => (
          <button key={key} onClick={() => setState(state === key ? 'all' : key)}
                  className={`card p-3 text-left transition ${
                    state === key ? 'ring-2 ring-forest-600' : 'hover:bg-paper-sunken'}`}>
            <div className="label">{label}</div>
            <div className={`mt-0.5 text-xl font-semibold tnum ${
              tone === 'refused' && n ? 'text-refused'
              : tone === 'allowed' ? 'text-allowed' : 'text-ink-900'}`}>
              {num(n || 0)}
            </div>
          </button>
        ))}
      </div>

      {c.forged_attempts > 0 && (
        <div className="card border-l-4 border-l-refused p-4 mb-5">
          <div className="text-sm font-semibold text-refused">
            {num(c.forged_attempts)} altered or fabricated code(s) presented at the gate
          </div>
          <p className="text-sm text-ink-600 mt-1">
            These carried no valid signature at all — they were never issued by this system.
            Under a printed ticket each one would have been admitted.
          </p>
        </div>
      )}

      <Section className="mb-5">
        <form className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Field label="Search" hint="Ticket number, vehicle or mobile">
            <input className="input min-w-[16rem]" value={q}
                   onChange={(e) => setQ(e.target.value)} placeholder="A7K2M9 or KA31N8147" />
          </Field>
          <Field label="Showing">
            <select className="input" value={state} onChange={(e) => setState(e.target.value)}>
              {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <button className="btn-primary">Search</button>
        </form>
      </Section>

      <Section>
        {!data ? <Loading what="Loading tickets" /> : (
          <Table
            onRowClick={setOpen}
            columns={[
              { key: 'ticket_no', label: 'Ticket',
                render: (r) => <span className="font-mono text-xs">{r.ticket_no}</span> },
              { key: 'reg_no', label: 'Vehicle',
                render: (r) => <span className="font-medium">{plate(r.reg_no)}</span> },
              { key: 'travel_date', label: 'Travel date',
                render: (r) => (
                  <div>
                    <div>{shortDate(r.travel_date)}</div>
                    <div className="text-2xs text-ink-500">
                      {r.slot_code === '0612' ? 'Morning' : 'Afternoon'}
                    </div>
                  </div>
                ) },
              { key: 'days_to_go', label: 'Days to go', align: 'right',
                render: (r) => r.status === 'used' ? <span className="text-ink-400">—</span>
                  : r.days_to_go > 0 ? <b className="text-forest-700">{r.days_to_go}</b>
                  : r.days_to_go === 0 ? <Pill tone="forest">Today</Pill>
                  : <span className="text-ink-400">past</span> },
              { key: 'state', label: 'State',
                render: (r) => {
                  if (r.status === 'cancelled') return <Pill tone="refused">Cancelled</Pill>;
                  if (r.status === 'used') return <Pill tone="allowed">Used</Pill>;
                  if (r.days_to_go < 0) return <Pill tone="muted">Never used</Pill>;
                  return <Pill tone="forest">Valid</Pill>;
                } },
              { key: 'scan_count', label: 'Scans', align: 'right',
                render: (r) => r.scan_count
                  ? <span className={r.scan_count > 1 ? 'font-semibold text-pending' : ''}>
                      {num(r.scan_count)}</span>
                  : <span className="text-ink-400">0</span> },
              { key: 'refused_count', label: 'Refused', align: 'right',
                render: (r) => r.refused_count
                  ? <b className="text-refused">{num(r.refused_count)}</b>
                  : <span className="text-ink-400">0</span> },
              { key: 'first_scan', label: 'First scan',
                render: (r) => r.first_scan
                  ? <span className="text-xs">{when(r.first_scan)}</span>
                  : <span className="text-ink-400">—</span> },
              { key: 'last_scan', label: 'Last scan',
                render: (r) => r.last_scan && r.scan_count > 1
                  ? <span className="text-xs">{when(r.last_scan)}</span>
                  : <span className="text-ink-400">—</span> },
              { key: 'move_count', label: 'Moved', align: 'right',
                render: (r) => r.move_count
                  ? <span className="text-pending">{r.move_count}×</span>
                  : <span className="text-ink-400">—</span> },
              { key: 'total_paise', label: 'Paid', align: 'right',
                render: (r) => rupees(r.total_paise) },
            ]}
            rows={data.rows}
            empty="No tickets match."
          />
        )}
      </Section>

      <Drawer open={!!open} title={open ? `Ticket ${open.ticket_no}` : ''}
              onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-5">
            <div className="card p-4">
              <div className="text-xl font-semibold">{plate(open.reg_no)}</div>
              <div className="text-sm text-ink-500 mt-0.5">
                {shortDate(open.travel_date)} · {open.slot_label} · {open.category_label}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div><dt className="label">Booked by</dt>
                  <dd className="mt-0.5">{open.wa_profile_name || '—'}<br />
                    <span className="font-mono text-2xs text-ink-500">{open.mobile}</span></dd></div>
                <div><dt className="label">Booked at</dt>
                  <dd className="mt-0.5">{when(open.created_at)}</dd></div>
                <div><dt className="label">Paid</dt>
                  <dd className="mt-0.5 font-semibold">{rupees(open.total_paise)}</dd></div>
                <div><dt className="label">Reference</dt>
                  <dd className="mt-0.5 font-mono text-2xs break-all">{open.reference_id}</dd></div>
                {open.used_at && (
                  <div><dt className="label">Entered at</dt>
                    <dd className="mt-0.5">{when(open.used_at)}</dd></div>
                )}
                {open.moved_from_date && (
                  <div><dt className="label">Moved from</dt>
                    <dd className="mt-0.5">{shortDate(open.moved_from_date)}</dd></div>
                )}
              </dl>
            </div>

            {open.verdicts?.length > 0 && (
              <div className="card p-4">
                <div className="label mb-2">Verdicts recorded against this code</div>
                <div className="flex flex-wrap gap-2">
                  {open.verdicts.map((v) => {
                    const d = verdict(v);
                    return <span key={v} className={`pill ${toneClass(d.tone)}`}>{d.label}</span>;
                  })}
                </div>
                {open.refused_count > 0 && (
                  <p className="mt-2 text-2xs text-refused">
                    This code was presented {num(open.scan_count)} times and refused{' '}
                    {num(open.refused_count)} of them — a copy has been circulating.
                  </p>
                )}
              </div>
            )}

            <div className="card p-4">
              <div className="label mb-2">The ticket as the visitor received it</div>
              {card ? (
                <img src={card} alt="Ticket" className="w-full rounded border border-ink-300/50" />
              ) : (
                <p className="text-sm text-ink-500 py-6 text-center">Loading the ticket…</p>
              )}
              {data?.show_qr && open.checkout_url && (
                <div className="mt-3">
                  <div className="label">Payment link</div>
                  <div className="mt-1 rounded bg-paper-sunken p-2 font-mono text-2xs break-all">
                    {open.checkout_url}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
