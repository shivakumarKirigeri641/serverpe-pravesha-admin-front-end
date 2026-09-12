import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Live from './pages/Live.jsx';
import Analytics from './pages/Analytics.jsx';
import Conversations from './pages/Conversations.jsx';
import Reports from './pages/Reports.jsx';
import Negative from './pages/Negative.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';
import Finance from './pages/Finance.jsx';
import Payments from './pages/Payments.jsx';
import Tickets from './pages/Tickets.jsx';
import Notifications from './pages/Notifications.jsx';
import Unverified from './pages/Unverified.jsx';
import Destinations from './pages/Destinations.jsx';
import Checkposts from './pages/Checkposts.jsx';
import Health from './pages/Health.jsx';
import Demo from './pages/Demo.jsx';
import SignIn from './pages/SignIn.jsx';
import { useSession, can } from './lib/session';

/*
 * Routes are added as each screen is built, so the URL space and the navigation
 * stay in step. Anything unknown goes to the dashboard rather than a 404: this
 * is a tool, not a website, and there is always somewhere useful to be.
 */
export default function App() {
  const { state, me } = useSession();

  if (state === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <img src="/icon-192.png" alt="" className="mx-auto h-10 w-10 rounded-lg opacity-80" />
          <p className="mt-3 text-sm text-muted">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (state !== 'ready') return <SignIn />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      {can(me, 'live.view') && <Route path="/live" element={<Live />} />}
      {can(me, 'analytics.view') && <Route path="/analytics" element={<Analytics />} />}
      {can(me, 'conversations.view') && <Route path="/conversations" element={<Conversations />} />}
      {can(me, 'reports.view') && <Route path="/reports" element={<Reports />} />}
      {can(me, 'negative.view') && <Route path="/negative" element={<Negative />} />}
      {can(me, 'unverified.view') && <Route path="/unverified" element={<Unverified />} />}
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/:tab" element={<Settings />} />
      {can(me, 'audit.view') && <Route path="/audit" element={<Audit />} />}
      {can(me, 'finance.view') && <Route path="/finance" element={<Finance />} />}
      {can(me, 'finance.view') && <Route path="/payments" element={<Payments />} />}
      {can(me, 'tickets.view') && <Route path="/tickets" element={<Tickets />} />}
      {can(me, 'tickets.view') && <Route path="/tickets/:id" element={<Tickets />} />}
      {can(me, 'alerts.view') && <Route path="/notifications" element={<Notifications />} />}
      {can(me, 'destinations.view') && <Route path="/destinations" element={<Destinations />} />}
      {can(me, 'destinations.view') && <Route path="/destinations/:id" element={<Destinations />} />}
      {can(me, 'destinations.view') && <Route path="/checkposts" element={<Checkposts />} />}
      {can(me, 'health.view') && <Route path="/health" element={<Health />} />}
      {can(me, 'demo.simulate') && <Route path="/demo" element={<Demo />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
