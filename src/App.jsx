import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Live from './pages/Live.jsx';
import Analytics from './pages/Analytics.jsx';
import Conversations from './pages/Conversations.jsx';
import SignIn from './pages/SignIn.jsx';
import { useSession } from './lib/session';

/*
 * Routes are added as each screen is built, so the URL space and the navigation
 * stay in step. Anything unknown goes to the dashboard rather than a 404: this
 * is a tool, not a website, and there is always somewhere useful to be.
 */
export default function App() {
  const { state } = useSession();

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
      <Route path="/live" element={<Live />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/conversations" element={<Conversations />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
