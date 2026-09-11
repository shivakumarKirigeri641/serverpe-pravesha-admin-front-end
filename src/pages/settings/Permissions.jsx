import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Banner, Loading } from '../../components/ui.jsx';

const GROUPS = [
  ['See', ['dashboard.view', 'live.view', 'alerts.view', 'destinations.view', 'analytics.view', 'reports.view', 'finance.view', 'conversations.view', 'conversations.technical', 'negative.view']],
  ['Act', ['alerts.act', 'announcements.manage', 'tickets.view', 'tickets.cancel', 'tickets.resend', 'negative.act', 'visitors.block', 'tickets.free', 'tickets.onspot', 'finance.expenses', 'finance.remit']],
  ['Configure', ['destinations.manage', 'settings.pricing', 'settings.slots', 'settings.staff', 'settings.users', 'settings.gst', 'audit.view']],
];

/*
 * Roles and permissions, as the server enforces them. Read-only by design:
 * the matrix is code, reviewed like code, so a role cannot quietly gain the
 * power to change prices from a checkbox.
 */
export default function Permissions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.permissions().then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <Banner tone="wrong">{error}</Banner>;
  if (!data) return <Loading />;

  const byKey = Object.fromEntries(data.capabilities.map((c) => [c.key, c]));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.roles.map((r) => (
          <div key={r.key} className={`card p-4 ${r.key === data.yourRole ? 'ring-2 ring-brand/30' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{r.label}</div>
              {r.key === data.yourRole && <span className="chip bg-brand/10 text-brand">Your role</span>}
            </div>
            <p className="mt-1 text-2xs text-muted">{r.description}</p>
          </div>
        ))}
        <div className="card border-dashed p-4">
          <div className="text-sm font-semibold text-ink">{data.gateStaff.label}</div>
          <p className="mt-1 text-2xs text-muted">{data.gateStaff.description} Managed under Checkpost staff.</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="th">Permission</th>
              {data.roles.map((r) => <th key={r.key} className="th text-center">{r.label}</th>)}
            </tr>
          </thead>
          {GROUPS.map(([group, keys]) => (
            <tbody key={group} className="divide-y divide-line">
              <tr className="bg-shell/60"><td colSpan={data.roles.length + 1} className="px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted">{group}</td></tr>
              {keys.filter((k) => byKey[k]).map((k) => (
                <tr key={k}>
                  <td className="td text-ink">{byKey[k].label}</td>
                  {data.roles.map((r) => (
                    <td key={r.key} className="td text-center">
                      {byKey[k].granted[r.key]
                        ? <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-good-50 text-good-700" aria-label="Allowed">✓</span>
                        : <span className="text-line" aria-label="Not allowed">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <Banner>
        Permissions are enforced by the server on every request; the menu only hides what a role could not open anyway. To change what a role may do, ask the development team — it is reviewed and released like any other change, and a user’s role is changed under Panel users.
      </Banner>
    </div>
  );
}
