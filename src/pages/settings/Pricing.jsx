import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { rupees } from '../../lib/format';
import { Banner, Loading, Reason, reasonOk, useAction, when } from '../../components/ui.jsx';

const ICON = { BIKE: '🏍️', CAR: '🚗', TOOFAN: '🚙', TT: '🚐' };

/*
 * Pricing. The entry price is the department's; the service fee is a percentage
 * of it, rounded to the rupee, and includes GST. Changing either writes new
 * price rows effective now — passes already held or paid keep what they cost.
 */
export default function Pricing() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState('');
  const [entries, setEntries] = useState({});
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(null);
  const { busy, error, setError, run } = useAction();

  const load = useCallback(() => api.pricing().then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const start = () => {
    setPct(String(data.serviceFeePercent));
    setEntries(Object.fromEntries(data.categories.map((c) => [c.code, String(c.entry)])));
    setReason('');
    setError(null);
    setDone(null);
    setEditing(true);
  };

  /* The same arithmetic the server applies, so the preview is the result. */
  const preview = useMemo(() => {
    if (!data) return [];
    const p = Number(pct);
    return data.categories.map((c) => {
      const entry = Number(entries[c.code]);
      const valid = Number.isInteger(entry) && entry >= 1;
      const fee = valid && Number.isFinite(p) ? Math.round((entry * p) / 100) : null;
      const gstBase = fee === null ? null : Math.round((fee * 100 * 100) / (100 + data.gstPercent)) / 100;
      return { ...c, newEntry: valid ? entry : null, newFee: fee, newTotal: fee === null ? null : entry + fee,
        newGst: fee === null ? null : Math.round((fee - gstBase) * 100) / 100,
        changed: valid && (entry !== c.entry || fee !== c.serviceFee) };
    });
  }, [data, pct, entries]);

  const pctValid = pct !== '' && Number(pct) >= 0 && Number(pct) <= 50;
  const anyChange = preview.some((p) => p.changed) || Number(pct) !== data?.serviceFeePercent;
  const canSave = pctValid && preview.every((p) => p.newEntry !== null) && anyChange && reasonOk(reason);

  async function save() {
    const out = await run(() => api.updatePricing({
      placeId: data.place.id, serviceFeePercent: Number(pct),
      entries: Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, Number(v)])), reason,
    }));
    if (out) {
      setEditing(false);
      setDone(`Prices updated for ${out.changed.length} vehicle type${out.changed.length === 1 ? '' : 's'}. New bookings use them from now.`);
      load();
    }
  }

  if (loadError) return <Banner tone="wrong">{loadError}</Banner>;
  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      {done && <Banner tone="good">{done}</Banner>}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">{data.place.name} — prices per vehicle</h2>
            <p className="mt-0.5 text-2xs text-muted">
              Service fee {data.serviceFeePercent}% of the entry price, rounded to the rupee · GST {data.gstPercent}% included in the fee
            </p>
          </div>
          {!editing && <button type="button" className="btn-primary" onClick={start}>Change prices</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-line bg-shell">
              <tr>
                <th className="th">Vehicle type</th>
                <th className="th text-right">Entry price</th>
                <th className="th text-right">Service fee</th>
                <th className="th text-right">Visitor pays</th>
                <th className="th text-right">GST within fee</th>
                <th className="th text-right">{editing ? 'Currently' : 'In effect since'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.map((c) => (
                <tr key={c.code} className={editing && c.changed ? 'bg-watch-50/40' : ''}>
                  <td className="td text-ink"><span className="mr-2" aria-hidden>{ICON[c.code]}</span>{c.label}</td>
                  <td className="td text-right">
                    {editing ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted">₹</span>
                        <input type="number" min="1" step="1" inputMode="numeric" aria-label={`${c.label} entry price`}
                          className="input !w-24 !py-1.5 text-right tabular" value={entries[c.code]}
                          onChange={(e) => setEntries((x) => ({ ...x, [c.code]: e.target.value }))} />
                      </div>
                    ) : <span className="tabular text-ink">{rupees(c.entry)}</span>}
                  </td>
                  <td className="td tabular text-right">{rupees(editing ? c.newFee : c.serviceFee)}</td>
                  <td className="td tabular text-right font-semibold text-ink">{rupees(editing ? c.newTotal : c.total)}</td>
                  <td className="td tabular text-right text-muted">₹{(editing ? c.newGst : c.gstWithinFee)?.toFixed(2)}</td>
                  <td className="td text-right text-2xs text-muted">
                    {editing ? `${rupees(c.entry)} + ${rupees(c.serviceFee)} = ${rupees(c.total)}` : when(c.effectiveFrom)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="grid gap-5 border-t border-line bg-shell/50 px-5 py-5 lg:grid-cols-[240px_1fr]">
            <label className="block">
              <span className="label">Service fee</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="50" step="0.5" className="input !w-28 tabular" value={pct}
                  onChange={(e) => setPct(e.target.value)} aria-label="Service fee percentage" />
                <span className="text-sm text-muted">% of entry</span>
              </div>
              <span className="mt-1 block text-2xs text-muted">{pctValid ? 'GST is inside this fee, not added to it.' : 'Between 0% and 50%.'}</span>
            </label>
            <div className="space-y-3">
              <Reason value={reason} onChange={setReason} />
              <Banner tone="watch">
                Applies to bookings made after you save. Passes already booked keep the price they were sold at.
              </Banner>
              {error && <Banner tone="wrong">{error}</Banner>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-quiet" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
                <button type="button" className="btn-primary" onClick={save} disabled={!canSave || busy}>
                  {busy ? 'Saving…' : 'Save new prices'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">Other charges</h3>
          <p className="mt-1 text-sm text-muted">
            None. A visitor pays the entry price and the service fee, nothing else — no convenience or payment charge is added at checkout.
          </p>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink">How the fee is worked out</h3>
          <p className="mt-1 text-sm text-muted">
            Fee = entry × {data.serviceFeePercent}%, rounded to the nearest rupee. GST at {data.gstPercent}% is part of that fee:
            on a ₹13 fee, ₹{(13 - 13 * 100 / (100 + data.gstPercent)).toFixed(2)} is GST.
          </p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink">Price history</h3>
          <p className="text-2xs text-muted">Every price ever charged, newest first. Nothing is overwritten.</p>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[560px]">
            <thead className="sticky top-0 border-b border-line bg-shell">
              <tr><th className="th">From</th><th className="th">Vehicle type</th><th className="th text-right">Entry</th><th className="th text-right">Fee</th><th className="th text-right">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.history.map((h, i) => (
                <tr key={`${h.code}-${h.effectiveFrom}-${i}`}>
                  <td className="td whitespace-nowrap text-2xs text-muted">{when(h.effectiveFrom)}</td>
                  <td className="td text-ink">{h.label}</td>
                  <td className="td tabular text-right">{rupees(h.entry)}</td>
                  <td className="td tabular text-right">{rupees(h.serviceFee)}</td>
                  <td className="td text-right">{h.current ? <span className="chip bg-good-50 text-good-700">Current</span> : <span className="chip bg-shell text-muted">Replaced</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
