import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, onSignedOut } from './api';

/*
 * The signed-in administrator, held once for the whole panel.
 *
 * A stored token is verified against the back-end on load rather than trusted:
 * it may have expired, or the account may have been disabled since the tab was
 * last open, and the panel must find that out before it draws a screen the
 * person is no longer entitled to.
 */
const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [me, setMe] = useState(null);
  const [state, setState] = useState(getToken() ? 'checking' : 'signed-out');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!getToken()) return undefined;
    let alive = true;
    api.session()
      .then((d) => { if (alive) { setMe(d); setState('ready'); } })
      .catch(() => { if (alive) setState('signed-out'); });
    return () => { alive = false; };
  }, []);

  useEffect(() => onSignedOut(() => {
    setMe(null);
    setState('signed-out');
    setNotice('Your session ended. Please sign in again.');
  }), []);

  const signIn = useCallback(async (mobile, password) => {
    const out = await api.signIn(mobile, password);
    if (out.ok) { setToken(out.token); setMe(out); setState('ready'); setNotice(null); }
    return out;
  }, []);

  /* The same session a password gives, reached with a code instead. */
  const signInWithCode = useCallback(async (mobile, code) => {
    const out = await api.verifyOtp(mobile, code);
    if (out.ok) { setToken(out.token); setMe(out); setState('ready'); setNotice(null); }
    return out;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.signOut(); } catch { /* the session ends locally regardless */ }
    setToken(null);
    setMe(null);
    setState('signed-out');
    setNotice(null);
  }, []);

  const value = useMemo(() => ({ me, state, signIn, signInWithCode, signOut, notice }), [me, state, signIn, signInWithCode, signOut, notice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** May the signed-in person do this? `cap` may be a list, any one of which is enough. */
export const can = (me, cap) => {
  /* A back-end that predates capabilities sends none: show the menu and let
     the server refuse what the role may not do, rather than hiding everything. */
  if (me && !Array.isArray(me.capabilities)) return true;
  const have = me?.capabilities || [];
  return (Array.isArray(cap) ? cap : [cap]).some((c) => have.includes(c));
};
