/**
 * Who did what in this panel.
 *
 * The privacy policy tells visitors that only authorised staff can see their
 * data. That sentence is only true if there is a record of which authorised
 * person saw it — this page is that record. Searches for a customer's number,
 * refunds, price changes and closures all land here.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { when } from '../lib/format';
import { PageHead, Section, Table, Loading, Pill } from '../components/ui';

const TONE = {
  login: 'muted', login_failed: 'refused', refund: 'refused',
  closure_created: 'refused', closure_lifted: 'pending',
  pricing_changed: 'pending', capacity_changed: 'pending', settings_changed: 'pending',
  staff_created: 'forest', staff_pin_reset: 'forest', device_registered: 'forest',
  device_revoked: 'refused', export: 'muted', search_bookings: 'muted',
  view_ticket: 'muted', resend_ticket: 'muted',
};

const WORDS = {
  login: 'Signed in', login_failed: 'Failed sign-in', refund: 'Refunded a ticket',
  closure_created: 'Closed a date', closure_lifted: 'Reopened a date',
  pricing_changed: 'Changed a price', capacity_changed: 'Changed capacity',
  settings_changed: 'Changed settings', staff_created: 'Added staff',
  staff_pin_reset: 'Reset a PIN', staff_activated: 'Activated staff',
  staff_deactivated: 'Deactivated staff', device_registered: 'Registered a phone',
  device_revoked: 'Withdrew a phone', export: 'Downloaded a report',
  search_bookings: 'Searched bookings', view_ticket: 'Opened a ticket',
  resend_ticket: 'Re-sent a ticket',
};

export default function Audit() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/audit', { quiet: true }).then((r) => setRows(r.rows)); }, []);

  return (
    <>
      <PageHead title="Audit trail"
                subtitle="Every action taken in this panel, most recent first." />
      <Section>
        {!rows ? <Loading what="Loading the audit trail" /> : (
          <Table
            columns={[
              { key: 'created_at', label: 'When', render: (r) => when(r.created_at) },
              { key: 'admin_name', label: 'Who',
                render: (r) => r.admin_name || <span className="text-ink-400">—</span> },
              { key: 'action', label: 'Action',
                render: (r) => <Pill tone={TONE[r.action] || 'muted'}>
                  {WORDS[r.action] || r.action}</Pill> },
              { key: 'subject', label: 'Subject',
                render: (r) => <span className="font-mono text-xs">{r.subject || '—'}</span> },
              { key: 'detail', label: 'Detail', className: 'whitespace-normal max-w-md',
                render: (r) => (
                  <span className="text-2xs text-ink-500">
                    {Object.keys(r.detail || {}).length
                      ? JSON.stringify(r.detail).slice(0, 160) : '—'}
                  </span>
                ) },
              { key: 'ip', label: 'From',
                render: (r) => <span className="text-2xs text-ink-400">{r.ip || '—'}</span> },
            ]}
            rows={rows}
            empty="Nothing recorded yet."
          />
        )}
      </Section>
    </>
  );
}
