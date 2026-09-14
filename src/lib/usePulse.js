import { useEffect, useRef } from 'react';
import { api } from './api';

/*
 * Reload a screen the moment something happens, not on a timer.
 *
 * Every few seconds this asks the server the one cheap question live monitoring
 * asks — has anything changed? — and calls `onChange` only when the answer
 * moves: a booking paid by any route, a pass sold at the gate, a vehicle
 * checked, a shift started or ended. A screen that shows bookings therefore
 * catches up within seconds of a successful booking, and sits still otherwise.
 *
 * It asks only while the tab is visible, and asks once more the moment the tab
 * comes back, so a screen left in a background tab all afternoon costs nothing.
 * A failed question is left to the next tick; the screen's own error handling
 * covers the reload itself.
 */
const ASK_MS = 3000;

export default function usePulse(onChange, { enabled = true } = {}) {
  const last = useRef(null);
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const tick = async () => {
      if (!alive || document.visibilityState !== 'visible') return;
      try {
        const p = await api.livePulse();
        if (!alive) return;
        const moved = last.current !== null && p.pulse !== last.current;
        last.current = p.pulse;
        if (moved) handler.current();
      } catch {
        /* the next tick asks again */
      }
    };
    tick();
    const id = setInterval(tick, ASK_MS);
    const onShow = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, [enabled]);
}
