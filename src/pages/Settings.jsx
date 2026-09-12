import { Navigate, NavLink, useParams } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import { useSession, can } from '../lib/session';
import Pricing from './settings/Pricing.jsx';
import Slots from './settings/Slots.jsx';
import Staff from './settings/Staff.jsx';
import Users from './settings/Users.jsx';
import Permissions from './settings/Permissions.jsx';
import Passes from './settings/Passes.jsx';
import Gst from './settings/Gst.jsx';
import Simulation from './settings/Simulation.jsx';

/*
 * Settings — how the service runs: what it costs, when it opens, who works the
 * gate, who uses this panel, and the details printed on every invoice.
 *
 * One tab per concern, each shown only to a role that may change it. Every
 * change asks for a reason and lands in the audit trail with the values before
 * and after, so "who changed the price, and why" always has an answer.
 */

const TABS = [
  { key: 'pricing', label: 'Pricing', cap: 'settings.pricing', page: Pricing, blurb: 'Entry prices and the service fee' },
  { key: 'slots', label: 'Slots & capacity', cap: 'settings.slots', page: Slots, blurb: 'Hours, dates and places per vehicle type' },
  { key: 'staff', label: 'Checkpost staff', cap: 'settings.staff', page: Staff, blurb: 'Gate app accounts, PINs and postings' },
  { key: 'passes', label: 'Free & on-spot passes', cap: ['tickets.free', 'tickets.onspot'], page: Passes, blurb: 'Passes issued from the panel' },
  { key: 'users', label: 'Panel users', cap: 'settings.users', page: Users, blurb: 'Who can sign in here, and as what' },
  { key: 'permissions', label: 'Roles & permissions', cap: null, page: Permissions, blurb: 'What each role may do' },
  { key: 'gst', label: 'GST & business', cap: 'settings.gst', page: Gst, blurb: 'Tax, invoice numbering and legal details' },
  { key: 'simulation', label: 'Demonstration mode', cap: 'settings.simulation', page: Simulation, blurb: 'Generate lifelike activity while showing the panel' },
];

export default function Settings() {
  const { tab } = useParams();
  const { me } = useSession();
  const allowed = TABS.filter((t) => !t.cap || can(me, t.cap));
  const current = allowed.find((t) => t.key === tab);

  if (!current) return <Navigate to={`/settings/${allowed[0].key}`} replace />;
  const Page = current.page;

  return (
    <Shell title="Settings" subtitle={current.blurb}>
      <nav className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:-mx-6 sm:px-6" aria-label="Settings sections">
        <ul className="flex min-w-max gap-1">
          {allowed.map((t) => (
            <li key={t.key}>
              <NavLink to={`/settings/${t.key}`}
                className={({ isActive }) => `-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Page />
    </Shell>
  );
}
