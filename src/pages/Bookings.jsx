/**
 * Every ticket, searchable, with the two support actions that actually get
 * asked for: send the QR again, and refund.
 *
 * The search box takes a vehicle number, a ticket number or a mobile number
 * without asking which — that is what a person at a counter has in front of
 * them, and making them choose a field first is friction for no gain.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, shortDate, when, plate, daysAgo, today, TICKET_STATUS, verdict, toneClass } from '../lib/format';
import { PageHead, Section, Table, Pill, Loading, Drawer, Confirm, Field } from '../components/ui';

export default function Bookings({ admin }) {
  const [filters, setFilters] = useState({
    from: daysAgo(7), to: '', status: '', q: '',
  });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);      // the ticket in the drawer
  const [detail, setDetail] = useState(null);
  const [refunding, setRefunding] = useState(false);

  async function load() {
    setBusy(true);
    const qs = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v)).toString();
    try {
      setData(await api.get(`/bookings?${qs}`, { quiet: true }));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.from, filters.to, filters.status]);

  // Searching is a deliberate act — it runs on submit, not on every keystroke,
  // because each search is written to the audit trail.
  function search(e) { e.preventDefault(); load(); }

  async function openTicket(row) {
    setOpen(row); setDetail(null);
    setDetail(await api.get(`/bookings/${row.ticket_no}`, { quiet: true }));
  }

  async function resend() {
    await api.post(`/bookings/${open.ticket_no}/resend`, {});
  }

  async function doRefund() {
    setRefunding(true);
    try {
      await api.post(`/bookings/${open.ticket_no}/refund`, { reason: 'admin_refund' });
      setOpen(null); load();
    } finally { setRefunding(false); }
  }

  return (
    <>
      <PageHead title="Bookings"
                subtitle={data ? `${data.total.toLocaleString('en-IN')} matching tickets` : ' '}>
        <button className="btn-ghost"
                onClick={() => api.download(
                  `/export/bookings?from=${filters.from || daysAgo(30)}&to=${filters.to || today()}`,
                  `bookings-${filters.from || daysAgo(30)}.csv`)}>
          Download CSV
        </button>
      </PageHead>

      <Section className="mb-5">
        <form onSubmit={search} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Field label="Travelling from">
            <input type="date" className="input" value={filters.from}
                   onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </Field>
          <Field label="to">
            <input type="date" className="input" value={filters.to}
                   onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="input" value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="paid">Booked</option>
              <option value="used">Entered</option>
              <option value="cancelled">Refunded</option>
              <option value="held">Unpaid</option>
            </select>
          </Field>
          <Field label="Search" hint="Vehicle, ticket or mobile number">
            <input className="input" placeholder="KA31N8147" value={filters.q}
                   onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </Field>
          <button className="btn-primary">Search</button>
        </form>
      </Section>

      <Section>
        {busy && !data ? <Loading what="Loading bookings" /> : (
          <Table
            onRowClick={openTicket}
            columns={[
              { key: 'ticket_no', label: 'Ticket',
                render: (r) => <span className="font-mono text-xs">{r.ticket_no}</span> },
              { key: 'reg_no', label: 'Vehicle',
                render: (r) => (
                  <div>
                    <div className="font-medium">{plate(r.reg_no)}</div>
                    {(r.maker || r.model) && (
                      <div className="text-2xs text-ink-500">
                        {[r.maker, r.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </div>
                ) },
              { key: 'category_label', label: 'Type' },
              { key: 'travel_date', label: 'Travel date',
                render: (r) => shortDate(r.travel_date) },
              { key: 'slot_label', label: 'Slot',
                render: (r) => r.slot_code === '0612' ? 'Morning' : 'Afternoon' },
              { key: 'mobile', label: 'Mobile',
                render: (r) => <span className="font-mono text-xs text-ink-600">{r.mobile}</span> },
              { key: 'status', label: 'Status',
                render: (r) => {
                  const s = TICKET_STATUS[r.status] || { label: r.status, tone: 'muted' };
                  return <Pill tone={s.tone}>{s.label}</Pill>;
                } },
              { key: 'total_paise', label: 'Paid', align: 'right',
                render: (r) => rupees(r.total_paise) },
              { key: 'created_at', label: 'Booked', align: 'right',
                render: (r) => <span className="text-ink-500 text-xs">{when(r.created_at)}</span> },
            ]}
            rows={data?.rows || []}
            empty="No tickets match those filters."
          />
        )}
      </Section>

      <Drawer open={!!open} title={open ? `Ticket ${open.ticket_no}` : ''} onClose={() => setOpen(null)}>
        {!detail ? <Loading what="Loading ticket" /> : (
          <TicketDetail
            t={detail.ticket}
            scans={detail.scans}
            canWrite={admin.can_write}
            onResend={resend}
            onRefund={() => setRefunding('confirm')}
          />
        )}
      </Drawer>

      <Confirm
        open={refunding === 'confirm'}
        danger
        title={`Refund ticket ${open?.ticket_no}?`}
        confirmWord="REFUND"
        confirmLabel="Refund in full"
        busy={refunding === true}
        onCancel={() => setRefunding(false)}
        onConfirm={doRefund}
        body={
          <>
            <p>
              <b>{rupees(open?.total_paise)}</b> will be returned to the customer's original
              payment method within 5–7 working days, and the ticket will be cancelled.
            </p>
            <p>
              The place is released back to the slot. The payment gateway's fee on the original
              payment is not recovered.
            </p>
          </>
        }
      />
    </>
  );
}

function TicketDetail({ t, scans, canWrite, onResend, onRefund }) {
  const s = TICKET_STATUS[t.status] || { label: t.status, tone: 'muted' };
  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-semibold">{plate(t.reg_no)}</div>
            <div className="text-sm text-ink-500">
              {[t.maker, t.model].filter(Boolean).join(' ') || t.category_label}
            </div>
          </div>
          <Pill tone={s.tone}>{s.label}</Pill>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Row k="Travel date" v={shortDate(t.travel_date)} />
          <Row k="Slot" v={t.slot_label} />
          <Row k="Type" v={t.category_label} />
          <Row k="Mobile" v={<span className="font-mono">{t.mobile}</span>} />
          <Row k="Booked" v={when(t.created_at)} />
          <Row k="Reference" v={<span className="font-mono text-2xs">{t.reference_id}</span>} />
          {t.moved_from_date && (
            <Row k="Moved from" v={`${shortDate(t.moved_from_date)} (${t.move_count}×)`} />
          )}
          {t.used_at && <Row k="Entered at" v={when(t.used_at)} />}
        </dl>
      </div>

      <div className="card p-4">
        <div className="label mb-2">Payment</div>
        <dl className="space-y-1.5 text-sm">
          <Money k="Entry fee (department)" v={t.entry_paise} />
          <Money k="Booking fee" v={t.platform_paise} />
          <Money k="— of which GST" v={t.gst_paise} muted />
          <div className="border-t border-ink-300/50 pt-1.5">
            <Money k="Total paid" v={t.total_paise} bold />
          </div>
        </dl>
      </div>

      <div className="card p-4">
        <div className="label mb-2">Gate history</div>
        {!scans?.length ? (
          <p className="text-sm text-ink-500 py-2">This ticket has not been presented yet.</p>
        ) : (
          <ul className="space-y-2">
            {scans.map((sc) => {
              const v = verdict(sc.verdict);
              return (
                <li key={sc.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className={`pill ${toneClass(v.tone)}`}>{v.label}</span>
                    <div className="text-2xs text-ink-500 mt-1">
                      {sc.staff_name || 'unknown staff'} · {sc.checkpost_name}
                      {sc.was_offline && ' · scanned offline'}
                    </div>
                  </div>
                  <div className="text-2xs text-ink-500 whitespace-nowrap">{when(sc.scanned_at)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canWrite && (
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onResend}>Send QR again</button>
          {t.status === 'paid' && (
            <button className="btn-danger flex-1" onClick={onRefund}>Refund</button>
          )}
        </div>
      )}
    </div>
  );
}

const Row = ({ k, v }) => (
  <div><dt className="label">{k}</dt><dd className="mt-0.5 text-ink-900">{v}</dd></div>
);

const Money = ({ k, v, bold, muted }) => (
  <div className={`flex justify-between ${muted ? 'text-ink-500' : ''} ${bold ? 'font-semibold' : ''}`}>
    <span>{k}</span><span className="tnum">{rupees(v)}</span>
  </div>
);
