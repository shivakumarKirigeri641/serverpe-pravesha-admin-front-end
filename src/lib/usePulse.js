import { useEffect, useRef, useState } from 'react';
import { api } from './api';

/*
 * Reload a screen the moment something happens, not on a timer.
 *
 * Every few seconds this asks the server the one cheap question live monitoring
 * asks — has anything changed? — and calls `onChange` only when the answer
 * moves: a booking paid by any route, a pass sold at the gate, a vehicle
 * checked, a shift started or ended, a refund, an invoice. A screen that shows
 * bookings therefore catches up within seconds of a successful booking, and
 * sits still otherwise.
 *
 * ONE QUESTION FOR THE WHOLE TAB (2026-09-16). A screen with a summary, a list
 * and a side panel used to ask three times every few seconds. Every subscriber
 * now shares one poller, which runs while at least one is mounted and stops
 * when the last goes.
 *
 * It asks only while the tab is visible, and asks once more the moment the tab
 * comes back, so a screen left in a background tab all afternoon costs nothing.
 * A failed question is left to the next tick; each screen's own error handling
 * covers the reload itself.
 */
const ASK_MS = 3000;

const subscribers = new Set();
let last = null;
let timer = null;
let asking = false;

async function tick() {
  if (asking || document.visibilityState !== 'visible' || subscribers.size === 0) return;
  asking = true;
  try {
    const p = await api.livePulse();
    const moved = last !== null && p.pulse !== last;
    last = p.pulse;
    if (moved) subscribers.forEach((fn) => fn());
  } catch {
    /* the next tick asks again */
  } finally {
    asking = false;
  }
}

const onShow = () => { if (document.visibilityState === 'visible') tick(); };

function subscribe(fn) {
  subscribers.add(fn);
  if (subscribers.size === 1) {
    tick();
    timer = setInterval(tick, ASK_MS);
    document.addEventListener('visibilitychange', onShow);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onShow);
      /* A screen opened later starts from its own first answer, not from one
         taken before it existed. */
      last = null;
    }
  };
}

export default function usePulse(onChange, { enabled = true } = {}) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(() => handler.current());
  }, [enabled]);
}

/**
 * A number that goes up whenever something happens — for a list whose fetch is
 * an effect keyed on its filters: put the number in the key, and the list
 * reloads with everything else it depends on.
 */
export function usePulseTick({ enabled = true } = {}) {
  const [n, setN] = useState(0);
  usePulse(() => setN((x) => x + 1), { enabled });
  return n;
}
