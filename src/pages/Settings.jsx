/**
 * Prices, capacities and the handful of rules that get argued about.
 *
 * Nothing here needs a deploy, which is the whole reason these live in the
 * database. Two behaviours worth knowing while using this page:
 *
 *   A PRICE CHANGE DOES NOT ALTER TICKETS ALREADY SOLD. Every ticket carries
 *   the figures it was sold at, frozen. The new price applies from its
 *   effective date onwards, and the old row stays as a record of what was
 *   charged when.
 *
 *   A CAPACITY CHANGE APPLIES TO TODAY ONWARDS, but never drops a day below
 *   what is already booked — that would mean turning away someone holding a
 *   paid ticket.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupees, num } from '../lib/format';
import { PageHead, Section, Loading, Field, Table } from '../components/ui';

export default function Settings({ admin }) {
  const [cfg, setCfg] = useState(null);
  const [prices, setPrices] = useState({});
  const [caps, setCaps] = useState({});
  const [vals, setVals] = useState({});
  const ro = !admin.can_write;

  async function load() {
    const c = await api.get('/config', { quiet: true });
    setCfg(c);
    setPrices(Object.fromEntries(c.pricing.map((p) => [p.category_id,
      { entry: p.entry_paise / 100, platform: p.platform_paise / 100 }])));
    setCaps(Object.fromEntries(c.capacity.map((x) => [`${x.slot_id}-${x.category_id}`, x.capacity])));
    setVals(c.settings);
  }
  useEffect(() => { load(); }, []);

  if (!cfg) return <Loading what="Loading configuration" />;

  async function savePrice(categoryId) {
    const p = prices[categoryId];
    await api.post('/config/pricing', {
      category_id: Number(categoryId),
      entry_paise: Math.round(Number(p.entry) * 100),
      platform_paise: Math.round(Number(p.platform) * 100),
    });
    load();
  }

  async function saveCapacity(slotId, categoryId) {
    const r = await api.post('/config/capacity', {
      slot_id: slotId, category_id: categoryId,
      capacity: Number(caps[`${slotId}-${categoryId}`]),
    });
    if (r.note) alert(r.note);
    load();
  }

  const gst = Number(vals.gst_percent_on_platform || 18);

  return (
    <>
      <PageHead title="Pricing & settings"
                subtitle={ro ? 'Your account can view these but not change them.' : 'Changes take effect immediately.'} />

      <Section title="Entry pricing"
               note="The entry fee goes to the department. The booking fee is ours and includes GST."
               className="mb-5">
        <div className="overflow-x-auto -mx-4 lg:-mx-5">
          <table className="w-full min-w-max">
            <thead className="bg-paper-sunken">
              <tr>
                <th className="th">Vehicle type</th>
                <th className="th">Entry fee (₹)</th>
                <th className="th">Booking fee (₹, incl. GST)</th>
                <th className="th text-right">Visitor pays</th>
                <th className="th text-right">GST inside fee</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {cfg.pricing.map((p) => {
                const v = prices[p.category_id] || { entry: 0, platform: 0 };
                const total = (Number(v.entry) + Number(v.platform)) * 100;
                const gstAmt = Math.round(Number(v.platform) * 100 * gst / (100 + gst));
                return (
                  <tr key={p.category_id} className="row">
                    <td className="td font-medium">{p.label}</td>
                    <td className="td">
                      <input className="input w-28 tnum" type="number" min="0" disabled={ro}
                             value={v.entry}
                             onChange={(e) => setPrices({ ...prices,
                               [p.category_id]: { ...v, entry: e.target.value } })} />
                    </td>
                    <td className="td">
                      <input className="input w-28 tnum" type="number" min="0" disabled={ro}
                             value={v.platform}
                             onChange={(e) => setPrices({ ...prices,
                               [p.category_id]: { ...v, platform: e.target.value } })} />
                    </td>
                    <td className="td text-right tnum font-semibold">{rupees(total)}</td>
                    <td className="td text-right tnum text-ink-500">{rupees(gstAmt)}</td>
                    <td className="td text-right">
                      {!ro && (
                        <button className="btn-ghost !py-1 !px-2 !text-xs"
                                onClick={() => savePrice(p.category_id)}>Save</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-2xs text-ink-500 leading-relaxed">
          Tickets already sold keep the price they were sold at. A change here applies to new
          bookings from today onwards.
        </p>
      </Section>

      <Section title="Capacity per slot"
               note="How many of each vehicle type each half of the day can take."
               className="mb-5">
        <div className="overflow-x-auto -mx-4 lg:-mx-5">
          <table className="w-full min-w-max">
            <thead className="bg-paper-sunken">
              <tr>
                <th className="th">Slot</th>
                <th className="th">Vehicle type</th>
                <th className="th">Capacity</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {cfg.capacity.map((c) => (
                <tr key={`${c.slot_id}-${c.category_id}`} className="row">
                  <td className="td">{c.slot_label}</td>
                  <td className="td font-medium">{c.category_label}</td>
                  <td className="td">
                    <input className="input w-28 tnum" type="number" min="0" disabled={ro}
                           value={caps[`${c.slot_id}-${c.category_id}`] ?? ''}
                           onChange={(e) => setCaps({ ...caps,
                             [`${c.slot_id}-${c.category_id}`]: e.target.value })} />
                  </td>
                  <td className="td text-right">
                    {!ro && (
                      <button className="btn-ghost !py-1 !px-2 !text-xs"
                              onClick={() => saveCapacity(c.slot_id, c.category_id)}>Save</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-2xs text-ink-500 leading-relaxed">
          Applies to today and every future date. A day that already has more bookings than the new
          number keeps its current capacity — nobody holding a paid ticket is turned away.
        </p>
      </Section>

      <Section title="Rules">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['gst_percent_on_platform', 'GST on booking fee (%)',
             'Applied to the booking fee only. The entry fee is collected as a pure agent.'],
            ['hold_minutes', 'Payment window (minutes)',
             'How long a slot is held while a customer is paying.'],
            ['slot_grace_minutes', 'Early arrival grace (minutes)',
             'How long before a slot starts a ticket is accepted. Late arrivals are always allowed.'],
            ['max_moves_per_ticket', 'Postpones allowed per ticket',
             'How many times one ticket may be moved to another date.'],
            ['same_day_booking', 'Allow booking for today (true/false)',
             'Whether today itself can still be booked.'],
            ['gateway_fee_percent', 'Gateway fee estimate (%)',
             'Used only to estimate take-home on the revenue page.'],
            ['refund_working_days', 'Refund promise (working days)',
             'What the refund message tells customers.'],
            ['support_mobile', 'Support number',
             'Shown on tickets and in the support menu.'],
            ['internal_mobiles', 'Internal numbers',
             'Comma-separated. Excluded from visitor statistics.'],
          ].map(([key, label, hint]) => (
            <Field key={key} label={label} hint={hint}>
              <input className="input" disabled={ro} value={vals[key] ?? ''}
                     onChange={(e) => setVals({ ...vals, [key]: e.target.value })} />
            </Field>
          ))}
        </div>

        {!ro && (
          <button className="btn-primary mt-4"
                  onClick={async () => {
                    await api.post('/config/settings', { settings: vals });
                    load();
                  }}>
            Save rules
          </button>
        )}
      </Section>
    </>
  );
}
