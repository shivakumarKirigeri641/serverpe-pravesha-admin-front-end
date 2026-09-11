import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Banner, Field, Loading, Reason, reasonOk, useAction } from '../../components/ui.jsx';

const RATES = [0, 5, 12, 18, 28];
const FIELDS = ['gstPercent', 'gstin', 'legalName', 'legalForm', 'address', 'udyam', 'email', 'website', 'sacCode', 'placeOfSupply', 'invoicePrefix'];

/*
 * GST and business details — what every invoice says about who issued it and
 * how the tax was worked out. Super administrator only; each change is audited
 * with the old and new values.
 */
export default function Gst() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(null);
  const { busy, error, run } = useAction();

  const load = useCallback(() => api.gst().then((d) => {
    setData(d);
    setForm(Object.fromEntries(FIELDS.map((f) => [f, String(d[f] ?? '')])));
    setLoadError(null);
  }).catch((e) => setLoadError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const changed = useMemo(() => (data && form ? FIELDS.filter((f) => String(form[f]) !== String(data[f] ?? '')) : []), [data, form]);

  if (loadError) return <Banner tone="wrong">{loadError}</Banner>;
  if (!data || !form) return <Loading />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const prefix = (form.invoicePrefix || '').toUpperCase();
  const nextNo = data.nextInvoiceNo.replace(/^[^/]+/, prefix || '???');
  const gstinOk = !form.gstin || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin.toUpperCase());
  const prefixOk = /^[A-Z0-9]{1,3}$/.test(prefix);

  /* A ₹13 service fee, worked through at the chosen rate. */
  const fee = 13;
  const rate = Number(form.gstPercent);
  const taxable = Math.round((fee * 100 / (100 + rate)) * 100) / 100;
  const tax = Math.round((fee - taxable) * 100) / 100;

  async function save() {
    const body = { reason, ...Object.fromEntries(changed.map((f) => [f, f === 'gstPercent' ? Number(form[f]) : form[f]])) };
    const out = await run(() => api.updateGst(body));
    if (out) { setDone(`Saved ${changed.length} change${changed.length === 1 ? '' : 's'}. New invoices use them from now.`); setReason(''); load(); }
  }

  return (
    <div className="space-y-5">
      {done && <Banner tone="good">{done}</Banner>}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink">Tax</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="GST rate on the service fee" hint="Rates notified under GST">
              <select className="input" value={form.gstPercent} onChange={set('gstPercent')}>
                {RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
            <Field label="Price display" hint={data.gstInclusiveNote}>
              <input className="input bg-shell" value="GST inclusive" disabled />
            </Field>
            <Field label="GSTIN" hint={gstinOk ? '15 characters' : 'Not a valid GSTIN'}>
              <input className={`input font-mono uppercase ${gstinOk ? '' : '!border-wrong-500'}`} maxLength={15} value={form.gstin} onChange={set('gstin')} />
            </Field>
            <Field label="SAC code"><input className="input font-mono" value={form.sacCode} onChange={set('sacCode')} /></Field>
            <Field label="Place of supply"><input className="input" value={form.placeOfSupply} onChange={set('placeOfSupply')} /></Field>
            <Field label="Invoice prefix" hint={prefixOk ? `Next invoice: ${nextNo}` : 'One to three letters or digits'}>
              <input className={`input font-mono uppercase ${prefixOk ? '' : '!border-wrong-500'}`} maxLength={3} value={form.invoicePrefix} onChange={set('invoicePrefix')} />
            </Field>
          </div>

          <h2 className="mt-7 text-sm font-semibold text-ink">Business details printed on invoices</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Legal name"><input className="input" value={form.legalName} onChange={set('legalName')} /></Field>
            <Field label="Legal form"><input className="input" value={form.legalForm} onChange={set('legalForm')} placeholder="Proprietorship" /></Field>
            <Field label="Registered address" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={form.address} onChange={set('address')} /></Field>
            <Field label="Udyam number"><input className="input font-mono" value={form.udyam} onChange={set('udyam')} /></Field>
            <Field label="Contact email"><input type="email" className="input" value={form.email} onChange={set('email')} /></Field>
            <Field label="Website"><input className="input" value={form.website} onChange={set('website')} /></Field>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <h3 className="text-sm font-semibold text-ink">How GST is calculated</h3>
            <p className="mt-1 text-2xs text-muted">GST applies to the Pravesha service fee only. The entry fee is collected for the Tourism Department and is not part of Pravesha’s taxable supply.</p>
            <dl className="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
              {[
                ['Service fee (what the visitor pays)', `₹${fee.toFixed(2)}`],
                [`Taxable value = fee × 100 ÷ ${100 + rate}`, `₹${taxable.toFixed(2)}`],
                [`GST at ${rate}%`, `₹${tax.toFixed(2)}`],
                ['Invoice total', `₹${fee.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-body">{k}</dt><dd className="tabular font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card space-y-3 p-5">
            {changed.length ? (
              <p className="text-sm text-ink">{changed.length} unsaved change{changed.length === 1 ? '' : 's'}.</p>
            ) : <p className="text-sm text-muted">No changes yet.</p>}
            <Reason value={reason} onChange={setReason} />
            {rate !== data.gstPercent && <Banner tone="watch">Changing the rate changes the GST on every invoice issued from now. Past invoices keep the rate they were issued at.</Banner>}
            {error && <Banner tone="wrong">{error}</Banner>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-quiet" disabled={busy || !changed.length} onClick={() => { load(); setReason(''); }}>Discard</button>
              <button type="button" className="btn-primary" onClick={save}
                disabled={busy || !changed.length || !reasonOk(reason) || !gstinOk || !prefixOk || !form.legalName.trim()}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
