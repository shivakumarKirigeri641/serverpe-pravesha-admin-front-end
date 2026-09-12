import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/*
 * Photographs taken at a barrier: the UPI screen behind a counter payment, and
 * the vehicle itself when it had no number plate to record.
 *
 * WHY SOMEBODY IN AN OFFICE LOOKS AT THESE. A reference number typed off a
 * visitor's phone is the weakest fact in the whole system — it cannot be checked
 * until the settlement arrives, and by then the vehicle is long gone. The
 * photograph is what turns "the staff member says it was paid" into something a
 * finance question can be answered with. For a vehicle with no plate it is the
 * only description of what came through that nobody typed.
 *
 * They load only when a pass is opened, and never appear in a list: a table of
 * strangers' number plates and payment screens is not something to render by
 * accident.
 */
const LABELS = { upi: 'Payment screen', vehicle: 'The vehicle', plate: 'Number plate', other: 'Photograph' };

export default function Photos({ photos }) {
  const [urls, setUrls] = useState({});
  const [big, setBig] = useState(null);

  useEffect(() => {
    let alive = true;
    const made = [];
    (async () => {
      for (const p of photos || []) {
        try {
          const url = await api.photoUrl(p.id);
          made.push(url);
          if (!alive) return;
          setUrls((m) => ({ ...m, [p.id]: url }));
        } catch { /* a photograph that will not load leaves its frame empty */ }
      }
    })();
    return () => { alive = false; made.forEach(URL.revokeObjectURL); };
  }, [photos]);

  if (!photos?.length) return null;

  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold text-ink">Photographs taken at the gate</h2>
      <div className="card flex flex-wrap gap-3 p-5">
        {photos.map((p) => (
          <figure key={p.id} className="w-40">
            <button type="button" onClick={() => urls[p.id] && setBig(urls[p.id])}
              className="block w-full overflow-hidden rounded-lg border border-line">
              {urls[p.id]
                ? <img src={urls[p.id]} alt={LABELS[p.kind] || 'Photograph'} className="h-28 w-full object-cover" />
                : <div className="grid h-28 place-items-center bg-shell text-2xs text-muted">loading…</div>}
            </button>
            <figcaption className="mt-1 text-2xs text-muted">
              {LABELS[p.kind] || p.kind}
              {p.by ? ` · ${p.by}` : ''}
              {p.size ? ` · ${Math.round(p.size / 1024)} KB` : ''}
            </figcaption>
          </figure>
        ))}
      </div>

      {big && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-6" onClick={() => setBig(null)}>
          <img src={big} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </section>
  );
}
