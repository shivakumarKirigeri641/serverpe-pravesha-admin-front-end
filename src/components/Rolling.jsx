import { useEffect, useRef, useState } from 'react';

/*
 * Rolling — numbers that change the way a petrol pump's used to.
 *
 * Each digit is a strip of 0-9 in a window one line tall; changing the number
 * slides the strip. The rightmost digit moves first and the ones to its left
 * follow a beat later, which is what makes it read as mechanical rather than as
 * a value being replaced.
 *
 * IT ROLLS THE WAY THE NUMBER GOES. On a counter going up, a 9 turning into a 0
 * carries on past 9 rather than spinning backwards — which is why the strip
 * carries an eleventh cell, a second 0 after the 9. The wrap lands on it and
 * then snaps back to the real 0 with the transition off, so the eye only ever
 * sees forward movement. A number going down rolls backwards, as the drum
 * would.
 *
 * IT NEVER ROLLS ON ARRIVAL. A screen opening would otherwise spin every number
 * on it at once, which looks like a slot machine and hides what actually
 * changed. The first render lands on the value; only later changes turn.
 *
 * WHY IT IS WORTH THE TROUBLE. These screens are watched, not read: a figure
 * that swaps silently from 161 to 162 tells nobody anything, while a digit that
 * turns catches the eye from across the room and says a vehicle just went
 * through. That is the whole job of live monitoring.
 *
 * Anything that is not a digit — a comma, a rupee sign, a decimal point, a
 * percent — is left alone, so formatting stays the panel's own.
 */

const STRIP = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DURATION = 520;
const STEP = 45;

const stillPlease = () => typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Digit({ char, delay, animate, rising }) {
  const digit = Number(char);
  const previous = useRef(digit);
  const [at, setAt] = useState(digit);      // which cell the strip is showing
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (previous.current === digit) return;
    const wrapped = rising && digit < previous.current;
    previous.current = digit;
    if (!animate) { setAt(digit); return; }
    setMoving(true);
    /* A wrap goes to the eleventh cell — the second 0 — so it travels forward. */
    setAt(wrapped ? 10 : digit);
  }, [digit, animate, rising]);

  /* Landing on the spare 0, put the strip back to the real one, silently. */
  const settle = () => {
    setMoving(false);
    if (at === 10) setAt(0);
  };

  if (!/\d/.test(char)) return <span className="rolling-fixed">{char}</span>;

  return (
    <span className="rolling-window">
      <span
        className="rolling-strip"
        onTransitionEnd={settle}
        style={{
          transform: `translateY(-${at}em)`,
          transitionDuration: animate && moving ? `${DURATION}ms` : '0ms',
          transitionDelay: animate && moving ? `${delay}ms` : '0ms',
        }}
      >
        {STRIP.map((d, i) => <span key={i} className="rolling-digit">{d}</span>)}
      </span>
    </span>
  );
}

const numeric = (s) => Number(String(s).replace(/[^\d.-]/g, '')) || 0;

/**
 * `text` is the already-formatted number — "1,467", "₹4,98,190.00", "98%".
 * Formatting stays with whoever knows what the number means.
 */
export default function Rolling({ text, className = '' }) {
  const value = String(text ?? '');
  const seen = useRef(false);
  const previous = useRef(numeric(value));
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    const t = setTimeout(() => setAnimate(!stillPlease()), 60);
    return () => clearTimeout(t);
  }, []);

  const now = numeric(value);
  const rising = now >= previous.current;
  previous.current = now;

  const chars = value.split('');
  /* The last digit leads; each one to its left follows a beat later. */
  const lastDigit = chars.reduce((last, c, i) => (/\d/.test(c) ? i : last), -1);

  return (
    <span className={`rolling ${className}`} aria-label={value} role="text">
      {chars.map((c, i) => (
        <Digit
          key={i}
          char={c}
          animate={animate}
          rising={rising}
          delay={/\d/.test(c) ? Math.max(0, lastDigit - i) * STEP : 0}
        />
      ))}
    </span>
  );
}
