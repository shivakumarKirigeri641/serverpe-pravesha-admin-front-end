/**
 * Routing, and the one piece of global state worth having: who is signed in.
 *
 * The session is confirmed with the server on load rather than trusted from
 * storage. A token in sessionStorage proves only that this browser once had
 * one — the account may since have been deactivated, and this panel is not one
 * where that distinction can be left vague.
 */

import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api, clearToken, getToken, setToastHandler, setUnauthorizedHandler } from './lib/api';
import Shell from './components/Shell';
import { Toaster, Loading } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Live from './pages/Live';
import Tickets from './pages/Tickets';
import Upcoming from './pages/Upcoming';
import Analytics from './pages/Analytics';
import Customers from './pages/Customers';
import Vehicles from './pages/Vehicles';
import StaffChecks from './pages/StaffChecks';
import Bookings from './pages/Bookings';
import GateLog from './pages/GateLog';
import Revenue from './pages/Revenue';
import Reports from './pages/Reports';
import Capacity from './pages/Capacity';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import Audit from './pages/Audit';
import Messages from './pages/Messages';

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [meta, setMeta] = useState({});
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setToastHandler((t) => setToast({ ...t, at: Date.now() }));
    setUnauthorizedHandler(() => { setAdmin(null); navigate('/login'); });
  }, [navigate]);

  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    api.get('/me', { quiet: true })
      .then((r) => { setAdmin(r.admin); setMeta({ product: r.product, places: r.places, authority: r.authority }); })
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  const signOut = useCallback(async () => {
    try { await api.post('/logout', {}, { quiet: true }); } catch { /* leaving anyway */ }
    clearToken();
    setAdmin(null);
    navigate('/login');
  }, [navigate]);

  if (checking) return <Loading what="Checking your session" />;

  if (!admin) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<Login onSignedIn={setAdmin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster toast={toast} />
      </>
    );
  }

  return (
    <>
      <Shell admin={admin} product={meta.product} places={meta.places}
             authority={meta.authority} onSignOut={signOut}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live" element={<Live />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/tickets" element={<Tickets />} />
          {/* The old address, kept so a bookmarked link still lands somewhere. */}
          <Route path="/qr" element={<Navigate to="/tickets" replace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/customers" element={<Customers admin={admin} />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/staff-checks" element={<StaffChecks />} />
          <Route path="/bookings" element={<Bookings admin={admin} />} />
          <Route path="/gate" element={<GateLog />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/capacity" element={<Capacity admin={admin} />} />
          <Route path="/staff" element={<Staff admin={admin} />} />
          <Route path="/settings" element={<Settings admin={admin} />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <Toaster toast={toast} />
    </>
  );
}
