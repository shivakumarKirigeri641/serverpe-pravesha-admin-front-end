import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/*
 * What just happened, said once, in the corner.
 *
 * WHY NOT A BANNER. A banner at the top of a screen says "this is the state of
 * things". Most of what this panel does is an event — a plate added to the
 * watchlist, a slot closed, a number changed — and an event wants a line that
 * appears where the eye already is, says what happened, and then leaves. A
 * banner for each of those either piles up or has to be dismissed by hand.
 *
 * WHAT A TOAST MAY NOT DO. It may not be the only place something important is
 * said: a refusal that needs acting on stays on the screen it belongs to. These
 * confirm what the person just did, and nothing else.
 *
 * IT WAITS FOR A READER. The timer holds while the pointer is over it, so a
 * long sentence is never snatched away mid-read, and a toast with an action on
 * it (Undo) is given longer. Everything is announced politely to a screen
 * reader, and none of it moves for anybody who has asked for less motion.
 */

const Ctx = createContext(null);
const TONES = {
  good: 'border-good-500/30 bg-good-50 text-good-700',
  warn: 'border-watch-500/30 bg-watch-50 text-watch-700',
  wrong: 'border-wrong-500/30 bg-wrong-50 text-wrong-700',
  plain: 'border-line bg-white text-ink',
};
const ICONS = { good: '✓', warn: '⚠', wrong: '✕', plain: '›' };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const hold = useCallback((id, ms) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    if (ms) timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  const show = useCallback((message, { tone = 'good', action = null, onAction = null, ms } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const life = ms ?? (action ? 9000 : 5000);
    /* Three at a time; the oldest goes rather than the stack growing. */
    setItems((list) => [...list.slice(-2), { id, message, tone, action, onAction, life }]);
    hold(id, life);
    return id;
  }, [hold]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const value = useMemo(() => ({
    show,
    good: (m, o) => show(m, { ...o, tone: 'good' }),
    warn: (m, o) => show(m, { ...o, tone: 'warn' }),
    wrong: (m, o) => show(m, { ...o, tone: 'wrong' }),
    dismiss,
  }), [show, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:px-6"
        role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id}
            className={`toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-pop ${TONES[t.tone] || TONES.plain}`}
            onMouseEnter={() => hold(t.id, 0)}
            onMouseLeave={() => hold(t.id, 2500)}>
            <span aria-hidden className="mt-px text-sm font-bold">{ICONS[t.tone] || ICONS.plain}</span>
            <p className="min-w-0 flex-1 text-sm leading-snug">{t.message}</p>
            {t.action && (
              <button type="button" className="shrink-0 text-sm font-bold underline"
                onClick={() => { t.onAction?.(); dismiss(t.id); }}>{t.action}</button>
            )}
            <button type="button" aria-label="Dismiss" className="shrink-0 text-sm opacity-60 hover:opacity-100"
              onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/* Screens that never render inside the provider (tests, isolated previews) get
   a version that does nothing rather than throwing. */
const QUIET = { show: () => {}, good: () => {}, warn: () => {}, wrong: () => {}, dismiss: () => {} };

export const useToast = () => useContext(Ctx) || QUIET;
