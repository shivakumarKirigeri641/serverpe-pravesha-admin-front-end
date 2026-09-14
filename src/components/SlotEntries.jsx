import { clock, number, plate } from '../lib/format';

/*
 * Today's slots on the live screen: for each, the first vehicle through the gate
 * and the latest one.
 *
 * ONE SECTION PER SLOT, TWO HALVES EACH. Morning on the left, afternoon on the
 * right on a wide screen; stacked on a narrow one. Inside a slot the first entry
 * sits beside the latest, so "when did it start moving" and "is it still moving"
 * are read side by side without opening the activity feed.
 *
 * AN EMPTY HALF SAYS WHY. Before the slot opens, before anybody has come, or
 * when only one vehicle has entered so far — each is a different fact, and a
 * blank card would make all three look like a fault.
 */

const VEHICLE_ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

const STATE = {
  open: ['Open now', 'bg-good-50 text-good-700'],
  upcoming: ['Not started', 'bg-shell text-muted'],
  over: ['Finished', 'bg-shell text-body'],
};

/* "Morning 6:00 AM - 12:00 PM" -> "Morning" */
const slotName = (label) => String(label || '').split(/\s+/)[0] || label;

export default function SlotEntries({ slots }) {
  if (!slots || slots.length === 0) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-muted">No slots are running today.</div>
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {slots.map((s) => <SlotSection key={s.slotId} slot={s} />)}
    </div>
  );
}

function SlotSection({ slot: s }) {
  const [stateLabel, stateTone] = STATE[s.state] || STATE.open;
  return (
    <section className="card overflow-hidden" aria-label={`${slotName(s.label)} slot`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">
            {slotName(s.label)} slot
            <span className="ml-2 font-normal text-muted">{s.startsAt}–{s.endsAt}</span>
          </h3>
          <p className="text-2xs text-muted">{s.placeName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted">
            <b className="tabular text-ink">{number(s.entered)}</b> entered of <b className="tabular text-ink">{number(s.booked)}</b> booked
          </span>
          <span className={`chip ${stateTone}`}>{stateLabel}</span>
        </div>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <Half title="First vehicle entered" entry={s.first}
          empty={s.state === 'upcoming' ? 'The slot has not started yet.' : 'No vehicle has entered in this slot yet.'} />
        <Half title="Latest vehicle entered" entry={s.latest}
          empty={s.onlyOne ? 'Only one vehicle so far — the first is also the latest.'
            : s.state === 'upcoming' ? 'The slot has not started yet.' : 'No vehicle has entered in this slot yet.'} />
      </div>
    </section>
  );
}

function Half({ title, entry, empty }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-2xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      {!entry ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <div className="mt-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-xl font-bold text-ink">{plate(entry.regNo)}</span>
            <span className="tabular text-sm font-semibold text-ink">{clock(entry.at)}</span>
          </div>
          <div className="mt-0.5 text-2xs text-muted">
            <span aria-hidden className="mr-1">{VEHICLE_ICON[entry.typeCode] || '🚘'}</span>
            {entry.type || '—'}
            {entry.ticketNo && <span className="font-mono"> · {entry.ticketNo}</span>}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-2xs">
            <div><dt className="text-muted">Visitor</dt><dd className="truncate text-body">{entry.visitor || '—'}</dd></div>
            <div>
              <dt className="text-muted">Recorded by</dt>
              <dd className="truncate text-body">
                {entry.selfDeclared ? 'Visitor, at the gate' : entry.staff || '—'}
                {entry.checkpost && !entry.selfDeclared ? ` · ${entry.checkpost}` : ''}
              </dd>
            </div>
          </dl>
          {entry.admittedAnyway && <span className="chip mt-2 bg-watch-50 text-watch-700">Admitted anyway</span>}
        </div>
      )}
    </div>
  );
}
