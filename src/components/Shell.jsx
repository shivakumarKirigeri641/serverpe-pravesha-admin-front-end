import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useSession, can } from '../lib/session';

/*
 * The frame every screen sits in: a fixed sidebar on a desk, a drawer on a
 * phone, and a slim top bar that only ever says where you are and who you are.
 *
 * THE NAVIGATION LISTS WHAT EXISTS. Items are added as their screen and its API
 * are built — a menu full of dead links is how an admin panel loses the trust of
 * the person using it. `soon: true` renders an item as a disabled label rather
 * than a link, so the shape of what is coming is visible without pretending.
 *
 * AND ONLY WHAT YOU MAY OPEN. `cap` is the capability the screen's API demands
 * (any one of a list will do); an item the role lacks is not drawn at all.
 */

const NAV = [
  {
    group: 'Watch',
    items: [
      { to: '/', label: 'Dashboard', icon: GridIcon, end: true, cap: 'dashboard.view' },
      { to: '/live', label: 'Live monitoring', icon: PulseIcon, cap: 'live.view' },
      { to: '/analytics', label: 'Data analytics', icon: ChartIcon, cap: 'analytics.view' },
      { to: '/reports', label: 'Reports', icon: ReportIcon, cap: 'reports.view' },
      { to: '/negative', label: 'Negative tracking', icon: AlertIcon, cap: 'negative.view' },
    ],
  },
  {
    group: 'Operate',
    items: [
      { to: '/conversations', label: 'Conversations', icon: ChatIcon, cap: 'conversations.view' },
      { to: '/settings/passes', label: 'Free & on-spot passes', icon: TicketIcon, cap: ['tickets.free', 'tickets.onspot'] },
      { to: '/tickets', label: 'Ticket management', icon: TicketIcon, cap: 'tickets.view', match: (path) => path.startsWith('/tickets') },
      { to: '/notifications', label: 'Notifications', icon: BellIcon, cap: 'alerts.view' },
      { to: '/settings/staff', label: 'Checkpost staff', icon: UsersIcon, cap: 'settings.staff' },
    ],
  },
  {
    group: 'Money',
    items: [
      { to: '/payments', label: 'Payments & Settlements', icon: SplitIcon, cap: 'finance.view' },
      { to: '/finance', label: 'My GST & Invoices', icon: RupeeIcon, cap: 'finance.view' },
    ],
  },
  {
    group: 'Administer',
    items: [
      { to: '/settings', label: 'Settings', icon: CogIcon, cap: ['settings.pricing', 'settings.slots', 'settings.staff', 'settings.users', 'settings.gst', 'tickets.free', 'tickets.onspot'],
        /* Staff and passes have their own entries above; everything else under /settings is here. */
        match: (path) => path.startsWith('/settings') && !/^\/settings\/(staff|passes)/.test(path) },
      { to: '/audit', label: 'Audit trail', icon: ShieldIcon, cap: 'audit.view' },
    ],
  },
];

export default function Shell({ title, subtitle, actions, children }) {
  const { me, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-line bg-white transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink">Pravesha</div>
            <div className="text-2xs uppercase tracking-wider text-muted">Administration</div>
          </div>
        </div>

        <nav className="h-[calc(100vh-3.5rem)] overflow-y-auto px-3 py-4">
          {NAV.map((section) => ({ ...section, items: section.items.filter((i) => !i.cap || can(me, i.cap)) }))
            .filter((section) => section.items.some((i) => !i.soon))
            .map((section) => (
            <div key={section.group} className="mb-5">
              <div className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted/80">{section.group}</div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    {item.soon ? (
                      <span className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted/60" title="Not built yet">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-2xs uppercase tracking-wider">soon</span>
                      </span>
                    ) : (
                      <NavLink
                        to={item.to} end={item.end} onClick={() => setOpen(false)}
                        className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                          (item.match ? item.match(pathname) : isActive) ? 'bg-brand text-white' : 'text-body hover:bg-shell hover:text-ink'}`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold text-ink">{title}</h1>
            {subtitle && <p className="truncate text-2xs text-muted">{subtitle}</p>}
          </div>

          {actions}

          <div className="flex items-center gap-2 border-l border-line pl-3">
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-semibold leading-tight text-ink">{me?.name}</div>
              <div className="text-2xs text-muted">{me?.roleLabel || me?.role}</div>
            </div>
            <button type="button" onClick={signOut} className="btn-quiet !px-3 !py-1.5 text-2xs">Sign out</button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

/* Line icons, drawn here rather than pulled from a package: nine of them at a
   few hundred bytes, against a dependency and its updates. */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Svg = ({ className = 'h-4 w-4', children }) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">{children}</svg>
);

function GridIcon(p) { return <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>; }
function AlertIcon(p) { return <Svg {...p}><path d="M12 3 2.5 20h19Z" /><path d="M12 10v4M12 17.2v.3" /></Svg>; }
function ReportIcon(p) { return <Svg {...p}><path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v5h5" /><path d="M9 17v-3M12 17v-6M15 17v-2" /></Svg>; }
function ChatIcon(p) { return <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M8.5 11h7M8.5 14h4" /></Svg>; }
function ChartIcon(p) { return <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>; }
function PulseIcon(p) { return <Svg {...p}><path d="M3 12h4l3-8 4 16 3-8h4" /></Svg>; }
function TicketIcon(p) { return <Svg {...p}><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6Z" /><path d="M13 5v14" strokeDasharray="2 3" /></Svg>; }
function BellIcon(p) { return <Svg {...p}><path d="M18 16V11a6 6 0 1 0-12 0v5l-1.5 3h15Z" /><path d="M10 21a2 2 0 0 0 4 0" /></Svg>; }
function SlidersIcon(p) { return <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></Svg>; }
function UsersIcon(p) { return <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 19a5 5 0 0 0-2-4" /></Svg>; }
function SplitIcon(p) { return <Svg {...p}><path d="M5 4v6a3 3 0 0 0 3 3h8" /><path d="M13 10l3 3-3 3" /><path d="M5 13v7" /></Svg>; }
function RupeeIcon(p) { return <Svg {...p}><path d="M7 5h10M7 9h10M15.5 5c0 4-3 6-8.5 6l8 8" /></Svg>; }
function DocIcon(p) { return <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Svg>; }
function CogIcon(p) { return <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Svg>; }
function ShieldIcon(p) { return <Svg {...p}><path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6Z" /><path d="m9 12 2 2 4-4" /></Svg>; }
