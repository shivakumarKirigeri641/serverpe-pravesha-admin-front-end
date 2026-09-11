/**
 * The frame every page sits in: identity on the left, context along the top.
 *
 * The sidebar is grouped rather than a flat list, because the three groups
 * answer three different questions — what happened today, what the money did,
 * and how the system is set up. An officer looking for a report should not have
 * to read past "Devices" to find it.
 */

import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';

const GROUPS = [
  {
    title: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', end: true },
      { to: '/live', label: 'Live', live: true },
      { to: '/upcoming', label: 'Upcoming' },
      { to: '/bookings', label: 'Bookings' },
      { to: '/tickets', label: 'Tickets' },
      { to: '/gate', label: 'Gate log' },
      { to: '/staff-checks', label: 'Staff checks' },
      { to: '/messages', label: 'Messages' },
    ],
  },
  {
    title: 'Money',
    items: [
      { to: '/analytics', label: 'Analytics' },
      { to: '/customers', label: 'Visitors' },
      { to: '/vehicles', label: 'Vehicles' },
      { to: '/revenue', label: 'Revenue & GST' },
      { to: '/reports', label: 'Reports' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/capacity', label: 'Capacity & closures' },
      { to: '/staff', label: 'Staff & devices' },
      { to: '/settings', label: 'Pricing & settings' },
      { to: '/audit', label: 'Audit trail' },
    ],
  },
];

export default function Shell({ admin, product, places, authority, onSignOut, children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // The system runs sites; it is not one. With a single site its name is the
  // useful subtitle, and with several it becomes a count — either way the
  // wording follows the data rather than being written into the interface.
  const sites = places || [];
  const siteLine = sites.length === 1 ? sites[0].name
    : sites.length ? `${sites.length} sites`
    : 'No sites configured';

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className={`${open ? 'block' : 'hidden'} lg:block lg:w-60 lg:shrink-0
                         bg-ink-900 text-ink-300 lg:min-h-screen`}>
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-white font-semibold leading-tight">
            {product || 'Entry Ticketing'}
          </div>
          <div className="text-2xs uppercase tracking-wider text-forest-500 mt-0.5">
            {siteLine}
          </div>
        </div>

        <nav className="p-3">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-4">
              <div className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-600">
                {g.title}
              </div>
              {g.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-forest-700 text-white'
                        : 'text-ink-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto px-5 py-4 border-t border-white/10 text-2xs text-ink-600">
          Powered by ServerPe App Solutions
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="bg-paper-raised border-b border-ink-300/50 px-4 lg:px-7 py-3
                           flex items-center justify-between gap-4 sticky top-0 z-10">
          <button className="lg:hidden btn-ghost !px-2.5 !py-1.5"
                  onClick={() => setOpen((v) => !v)} aria-label="Menu">☰</button>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900 truncate">
              {titleFor(pathname)}
            </div>
            <div className="text-2xs text-ink-500">
              {[authority, sites.length === 1 ? sites[0].district : null]
                .filter(Boolean).join(' · ')}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-ink-900 leading-tight">{admin?.name}</div>
              <div className="text-2xs text-ink-500 capitalize">
                {admin?.role}{!admin?.can_write && ' · read only'}
              </div>
            </div>
            <button className="btn-ghost !py-1.5" onClick={onSignOut}>Sign out</button>
          </div>
        </header>

        <main className="p-4 lg:p-7 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

function titleFor(path) {
  if (path === '/') return 'Dashboard';
  const map = {
    '/bookings': 'Bookings', '/gate': 'Gate log', '/revenue': 'Revenue & GST', '/reports': 'Reports',
    '/capacity': 'Capacity & closures', '/staff': 'Staff & devices',
    '/settings': 'Pricing & settings', '/audit': 'Audit trail', '/messages': 'Messages',
  };
  return map[path] || Object.entries(map).find(([k]) => path.startsWith(k))?.[1] || 'Administration';
}
