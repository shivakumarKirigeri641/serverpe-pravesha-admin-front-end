/*
 * What the words on these screens actually mean.
 *
 * WHY ONE LIST. The panel is read by people who did not build it — a checkpost
 * manager covering an evening, an officer opening it once a month — and half the
 * words on it are ours: "skipped", "suspicious", "held", "declared". Each needs
 * the same explanation everywhere it appears, or the screens quietly teach three
 * different meanings for one word.
 *
 * WHAT AN ENTRY SAYS. Not a definition of the English word: how this figure is
 * counted, and what somebody should do about it. "Skipped" is not "did not come"
 * — it is a paid pass whose slot has closed, which is a place nobody else could
 * buy. That is the sentence worth showing on hover.
 */

const GLOSSARY = {
  /* Bookings */
  'total booked': 'Every pass paid for this date, whenever it was bought — advance and same-day together.',
  advance: 'Bought on an earlier day. A high share means people are planning ahead, which makes capacity easier to manage.',
  'same day': 'Bought on the day of travel, usually on the road or at the barrier.',
  'abandoned at payment': 'Somebody reached the payment page, a place was held for them, and they never paid. The place was given back automatically.',

  /* Visitor status */
  booked: 'Passes paid for, for this date.',
  entered: 'Vehicles recorded going in at a gate.',
  'yet to arrive': 'Paid passes whose slot is still open. They may still turn up.',
  skipped: 'Paid passes whose slot has closed without the vehicle arriving. The money is ours, but the place was wasted — nobody else could buy it.',
  'inside now': 'An estimate: vehicles admitted whose slot has not ended. No exit is recorded at the barrier, so nobody can know exactly.',
  'total entries': 'Every admitted check, including a vehicle checked a second time — so it can be higher than the number of visitors.',
  'checked at gate': 'Every pass a staff member looked up, however it ended — admitted, refused, or outside its slot.',

  /* Verification */
  valid: 'The pass was good and the vehicle was let in.',
  used: 'The entry was recorded against the pass.',
  duplicate: 'The same pass was presented again after it had already been used. One pass is one entry.',
  invalid: 'Refused for a plain reason: wrong day, wrong destination, never paid, or no such pass.',
  'repeat attempt': 'The same vehicle was refused and tried again — at the same gate or the other one.',
  suspicious: 'Duplicates and repeat attempts together: the checks worth a second look at the end of a day.',
  'outside slot': 'The vehicle arrived before its slot opened, or after the last entry an hour before it ends.',
  'admitted anyway': 'A staff member let a vehicle in outside its slot. Allowed, and recorded with their name on it.',
  'vehicle mismatch': 'Not measured: staff look a vehicle up by its own number, so there is nothing to mismatch.',
  'watchlist — blocked': 'The office put this number plate on the watchlist. Gates refuse it whatever pass it holds.',

  /* Gate and capacity */
  'places today': 'How many vehicles of this type may still be sold for this slot today. Lowering it stops further sales; it never cancels a pass somebody paid for.',
  held: 'A place claimed by somebody on the payment page who has not paid yet. It is released automatically if they do not.',
  'self-declared': 'The visitor ticked "I am already at the checkpost" when paying, and their phone agreed they were standing at the gate. Nobody at the gate has seen the vehicle.',
  offline: 'Recorded on a gate phone with no signal and sent when the signal returned. The time shown is when the vehicle actually came through.',
  declared: 'The vehicle register could not identify the vehicle, so the staff member said what it was — which also set the price.',
  'no plate': 'A vehicle with no number plate at all, identified by hand (usually a chassis number) and photographed at the barrier.',

  /* Money */
  collected: 'Money actually taken for passes on this date, before any refund.',
  'department amount': 'The entry fees, collected on the Tourism Department’s behalf. Not ours.',
  'service fee': 'Pravesha’s share, GST inclusive.',
  refunded: 'Money given back on passes for this date, whenever the refund was made.',
};

/** The explanation for a term, or nothing. Matching is case-insensitive. */
export const explain = (term) => GLOSSARY[String(term || '').trim().toLowerCase()] || null;

export default GLOSSARY;
