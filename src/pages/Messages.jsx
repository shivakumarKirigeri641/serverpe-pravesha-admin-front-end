/**
 * What visitors said, in their own words.
 *
 * Support requests and feedback arrive through the WhatsApp menu and land here
 * verbatim. Nothing is auto-replied to: a complaint about a gate is a thing a
 * person should answer, and pretending otherwise is how a department ends up
 * with an inbox nobody reads.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { when } from '../lib/format';
import { PageHead, Section, Loading, Empty } from '../components/ui';

export default function Messages() {
  const [kind, setKind] = useState('support_request');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    api.get(`/messages?kind=${kind === 'feedback' ? 'feedback' : 'support'}`, { quiet: true })
      .then((r) => setRows(r.rows));
  }, [kind]);

  return (
    <>
      <PageHead title="Messages" subtitle="Support requests and feedback from visitors.">
        <button className={kind === 'support_request' ? 'btn-primary' : 'btn-ghost'}
                onClick={() => setKind('support_request')}>Support</button>
        <button className={kind === 'feedback' ? 'btn-primary' : 'btn-ghost'}
                onClick={() => setKind('feedback')}>Feedback</button>
      </PageHead>

      <Section>
        {!rows ? <Loading what="Loading messages" />
          : !rows.length ? <Empty>No {kind === 'feedback' ? 'feedback' : 'support requests'} yet.</Empty>
          : (
            <ul className="divide-y divide-ink-300/40">
              {rows.map((r) => (
                <li key={r.id} className="py-4 first:pt-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm font-medium text-ink-900">
                      {r.wa_profile_name || 'Visitor'}
                      <span className="ml-2 font-mono text-2xs text-ink-500">{r.mobile}</span>
                    </div>
                    <div className="text-2xs text-ink-500 whitespace-nowrap">{when(r.created_at)}</div>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-700 whitespace-pre-wrap">
                    {r.detail?.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
      </Section>
    </>
  );
}
