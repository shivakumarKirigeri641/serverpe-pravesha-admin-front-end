import { useEffect, useId, useRef, useState } from 'react';
import { explain } from '../lib/glossary';

/*
 * A word on a screen, with what it means one hover away.
 *
 * WHO IT IS FOR. Whoever is reading the panel without having built it. A
 * checkpost manager covering an evening should not have to guess whether
 * "skipped" means somebody was turned away or simply never came, and should not
 * have to ask the office to find out.
 *
 * HOVER, FOCUS, OR TAP. Hover is not available on the phone somebody actually
 * opens this on at a gate, so the term is a real button: tapping opens the same
 * note, tapping again or anywhere else closes it, and Escape closes it too. It
 * is reachable by keyboard and announced to a screen reader.
 *
 * QUIET UNTIL WANTED. A dotted underline is the only mark on the page; nothing
 * moves, nothing is coloured, and a term with no explanation renders as plain
 * text rather than a control that does nothing.
 */
/*
 * ABOVE THE WORD, NOT BELOW IT. A note opening downwards lands under the
 * pointer in the middle of a row and is read over the cursor and the next line;
 * opening upwards keeps the word and its explanation both visible.
 */
export default function Explain({ term, text, children, className = '', side = 'top' }) {
  const note = text || explain(term || (typeof children === 'string' ? children : ''));
  const [open, setOpen] = useState(false);
  const id = useId();
  const holder = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (holder.current && !holder.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!note) return <span className={className}>{children ?? term}</span>;

  return (
    <span ref={holder} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="explain-term"
      >
        {children ?? term}
      </button>
      <span id={id} role="tooltip" hidden={!open}
        className={`explain-note ${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
        {note}
      </span>
    </span>
  );
}
