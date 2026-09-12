import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import Photos from '../components/Photos.jsx';
import { api } from '../lib/api';
import { dayLabel, number, plate, rupees } from '../lib/format';
import { Banner, Loading, when } from '../components/ui.jsx';

/*
 * Vehicles — the register as this service has come to know it.
 *
 * Every other screen is organised around a moment: a pass, a payment, a check at
 * a barrier. This one is organised around a vehicle, because some questions can
 * only be answered that way. "That red Seltos is here every Sunday" is a fact
 * about a vehicle, and no amount of reading passes one at a time will show it.
 *
 * THE LIST IS ORDERED BY WHEN A VEHICLE WAS LAST HERE, not by registration
 * number. Somebody opening this screen is nearly always looking for something
 * recent; an alphabetical register is a filing cabinet, not a screen.
 *
 * THE DETAIL ANSWERS IN ONE PAGE what would otherwise be four searches: what the
 * register says it is, how often it has come, whether it actually arrived each
 * time, who books it, what it has paid, and every look anybody has taken at it
 * at a barrier — refusals included, because those are usually the interesting
 * ones.
 *
 * MONEY IS ABSENT, NOT ZERO, for anybody without permission to see it. The
 * server strips it and says so; this screen hides the columns rather than
 * printing ₹0 and inviting somebody to act on a number that is not there.
 */

const KIND_TONE = {
  rc: 'bg-good-50 text-good-700',
  declared: 'bg-warn-50 text-warn-700',
  no_plate: 'bg-wrong-50 text-wrong-700',
};

const VERDICTS = {
  valid: ['Entered', 'bg-good-50 text-good-700'],
  valid_override: ['Allowed in', 'bg-warn-50 text-warn-700'],
  already_used: ['Refused — already used', 'bg-wrong-50 text-wrong-700'],
  wrong_day: ['Refused — wrong day', 'bg-wrong-50 text-wrong-700'],
  wrong_slot: ['Outside the slot', 'bg-warn-50 text-warn-700'],
  wrong_place: ['Refused — wrong place', 'bg-wrong-50 text-wrong-700'],
  not_paid: ['Refused — not paid', 'bg-wrong-50 text-wrong-700'],
  unknown_ticket: ['No pass found', 'bg-wrong-50 text-wrong-700'],
  cancelled: ['Refused — cancelled', 'bg-wrong-50 text-wrong-700'],
};

const STATUS = {
  used: ['Entered', 'bg-good-50 text-good-700'],
  paid: ['Not used', 'bg-shell text-muted'],
  cancelled: ['Cancelled', 'bg-wrong-50 text-wrong-700'],
  expired: ['Abandoned', 'bg-shell text-muted'],
  held: ['Being paid for', 'bg-warn-50 text-warn-700'],
};

const SORTS = [['recent', 'Last visit'], ['visits', 'Most visits'], ['revenue', 'Most paid'], ['plate', 'Number']];
const KINDS = [['', 'All'], ['rc', 'Verified'], ['declared', 'Declared'], ['no_plate', 'No plate']];

export default function Vehicles() {
  const { regNo } = useParams();
  return regNo ? <OneVehicle regNo={regNo} /> : <VehicleList />;
}

/* ─────────────────────────────────────────────────────────────── the list ── */

function VehicleList() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState('recent');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => { const id = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 250); return () => clearTimeout(id); }, [q]);

  const load = useCallback(async () => {
    try {
      setData(await api.vehicles({ q: term, kind, sort, limit: 25, offset: page * 25 }));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [term, kind, sort, page]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.vehicles || [];
  const money = data ? !data.moneyHidden : false;

  return (
    <Shell
      title="Vehicles"
      subtitle={data ? `${number(data.total)} vehicle${data.total === 1 ? '' : 's'} have been here` : 'Loading…'}
    >
      {error && <Banner tone="wrong">{error}</Banner>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input min-w-[240px] flex-1" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Number plate, chassis number or the visitor's mobile" />
        <select className="input w-auto" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {!data ? <Loading /> : rows.length === 0 ? (
        <div className="card px-5 py-12 text-center text-sm text-muted">
          {term ? 'No vehicle matches that.' : 'No vehicle has been here yet.'}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-muted">
                <th className="th text-left">Vehicle</th>
                <th className="th text-left">Type</th>
                <th className="th text-right">Passes</th>
                <th className="th text-right">Entered</th>
                <th className="th text-left">Last visit</th>
                {money && <th className="th text-right">Paid</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="cursor-pointer border-b border-line/60 align-top last:border-0 hover:bg-shell"
                  onClick={() => navigate(`/vehicles/${encodeURIComponent(v.regNo)}`)}>
                  <td className="td">
                    <div className="font-mono text-sm text-ink">{v.kind === 'no_plate' ? <span className="text-muted">{v.regNo}</span> : plate(v.regNo)}</div>
                    <div className="text-2xs text-muted">{v.description || '—'}{v.colour ? ` · ${v.colour}` : ''}</div>
                    <span className={`chip mt-1 ${KIND_TONE[v.kind] || 'bg-shell text-muted'}`}>{v.kindLabel}</span>
                    {!v.allowed && <span className="chip ml-1 bg-wrong-50 text-wrong-700">Not allowed</span>}
                  </td>
                  <td className="td text-ink">{v.type || '—'}</td>
                  <td className="td tabular text-right">{number(v.passes)}</td>
                  <td className="td tabular text-right">
                    {number(v.entries)}
                    {v.passes > v.entries && <div className="text-2xs text-muted">{number(v.passes - v.entries)} not used</div>}
                  </td>
                  <td className="td">
                    <div className="whitespace-nowrap">{v.lastVisit ? dayLabel(v.lastVisit) : '—'}</div>
                    {v.visitors > 1 && <div className="text-2xs text-muted">{number(v.visitors)} different visitors</div>}
                  </td>
                  {money && <td className="td tabular text-right font-semibold text-ink">{rupees(v.revenue)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 25 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" className="btn-quiet" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Back</button>
          <span className="text-muted">{page * 25 + 1}–{Math.min((page + 1) * 25, data.total)} of {number(data.total)}</span>
          <button type="button" className="btn-quiet" disabled={(page + 1) * 25 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </Shell>
  );
}

/* ───────────────────────────────────────────────────────────── one vehicle ── */

function OneVehicle({ regNo }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.vehicle(regNo)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [regNo]);

  if (error) return <Shell title={regNo}><Banner tone="wrong">{error}</Banner></Shell>;
  if (!data) return <Shell title={regNo}><Loading /></Shell>;

  const v = data.vehicle;
  const t = data.totals;
  const money = !data.moneyHidden;

  return (
    <Shell
      title={v.kind === 'no_plate' ? v.regNo : plate(v.regNo)}
      subtitle={[v.maker, v.model].filter(Boolean).join(' ') || v.vehicleClass || 'Vehicle'}
      /* Back goes back where they came from — often another vehicle, reached
         from a visitor's other vehicles — and falls back to the list when this
         page was opened directly from a link or a reload. */
      onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/vehicles'))}
      backLabel="Vehicles"
      actions={<button type="button" className="btn-quiet" onClick={() => navigate('/vehicles')}>All vehicles</button>}
    >
      {!v.allowed && (
        <Banner tone="wrong">This vehicle is not allowed entry{v.blockedReason ? ` — ${v.blockedReason}` : ''}.</Banner>
      )}
      {v.kind !== 'rc' && (
        <Banner tone="warn">
          {v.kindLabel}. {v.identity
            ? <>Identified by {String(v.identity.kind).replace(/_/g, ' ')}: <span className="font-mono">{v.identity.value}</span>.</>
            : 'Nothing was recorded to identify it.'} Whoever decided the type also decided the price.
        </Banner>
      )}

      {/* What it has done here, which is the reason anybody opened this page. */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Passes bought" value={number(t.passes)} note={`on ${number(t.days)} day${t.days === 1 ? '' : 's'}`} />
        <Stat label="Times entered" value={number(t.entries)} note={t.noShows > 0 ? `${number(t.noShows)} never arrived` : 'every pass used'} />
        <Stat label="Visitors" value={number(t.visitors)} note={t.visitors > 1 ? 'different people booked it' : 'one person books it'} />
        {money
          ? <Stat label="Paid in total" value={rupees(t.revenue)} note={t.refunded > 0 ? `${rupees(t.refunded)} refunded` : 'nothing refunded'} />
          : <Stat label="Last visit" value={t.lastVisit ? dayLabel(t.lastVisit) : '—'} note={t.firstVisit ? `first came ${dayLabel(t.firstVisit)}` : ''} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="What the register says" rows={[
          ['Registration', v.regNo],
          ['Make and model', [v.maker, v.model].filter(Boolean).join(' ') || '—'],
          ['Class', v.vehicleClass || '—'],
          ['Body', v.bodyType || '—'],
          ['Colour', v.colour || '—'],
          ['Fuel', v.fuel || '—'],
          ['Seats', v.seats ? String(v.seats) : '—'],
          ['Registered', v.registeredOn ? dayLabel(v.registeredOn) : '—'],
          ['Registered at', v.registeredAt || '—'],
          ['RC status', v.rcStatus || '—'],
          ['Looked up', v.verifiedAt ? when(v.verifiedAt) : 'never — the type was declared'],
        ]} />

        {money && (
          <Panel title="Money" rows={[
            ['Collected', rupees(t.collected)],
            ['Entry fees (Department)', rupees(t.department)],
            ['Service fee (Pravesha)', rupees(t.serviceFee)],
            ['GST within the fee', rupees(t.gst)],
            ['Refunded', rupees(t.refunded)],
            ['Net', rupees(t.revenue)],
          ]} />
        )}

        <Bookers visitors={data.visitors} total={t.visitors} />

        <Panel title="When it comes" rows={[
          ...(data.pattern.byDay.length ? data.pattern.byDay.map((d) => [d.day, `${number(d.passes)} visit${d.passes === 1 ? '' : 's'}`]) : [['No pattern yet', '—']]),
          ...data.pattern.bySlot.map((sl) => [sl.slot, `${number(sl.passes)} visit${sl.passes === 1 ? '' : 's'}`]),
        ]} />
      </div>

      {data.photos?.length > 0 && <div className="mt-5"><Photos photos={data.photos} /></div>}

      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold text-ink">Its passes</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-muted">
                <th className="th text-left">Pass</th>
                <th className="th text-left">For</th>
                <th className="th text-left">Visitor</th>
                <th className="th text-left">Entry</th>
                {money && <th className="th text-right">Paid</th>}
              </tr>
            </thead>
            <tbody>
              {data.passes.map((p) => {
                const [label, tone] = STATUS[p.status] || [p.status, 'bg-shell text-muted'];
                return (
                  <tr key={p.id} className="cursor-pointer border-b border-line/60 align-top last:border-0 hover:bg-shell"
                    onClick={() => navigate(`/tickets/${p.id}`)}>
                    <td className="td">
                      <div className="font-mono text-sm text-ink">{p.ticketNo}</div>
                      <div className="text-2xs text-muted">{p.invoiceNo || 'no invoice'}{p.soldAs ? ` · ${p.soldAs}` : ''}</div>
                    </td>
                    <td className="td">
                      <div className="whitespace-nowrap">{dayLabel(p.travelDate)}</div>
                      <div className="text-2xs text-muted">{p.slot} · {p.type}{p.declaredType ? ' · declared' : ''}</div>
                    </td>
                    <td className="td"><div>{p.visitor || '—'}</div><div className="text-2xs text-muted">{p.mobile}</div></td>
                    <td className="td">
                      <span className={`chip ${tone}`}>{label}</span>
                      {p.enteredAt && (
                        <div className="text-2xs text-muted">
                          {when(p.enteredAt)}{p.entrySource === 'self' ? ' · recorded by the visitor' : ''}
                        </div>
                      )}
                    </td>
                    {money && (
                      <td className="td tabular text-right">
                        <div className="font-semibold text-ink">{rupees(p.amount)}</div>
                        {p.refunded > 0 && <div className="text-2xs text-wrong-700">{rupees(p.refunded)} back</div>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold text-ink">Every look at it at a barrier</h2>
        {data.checks.length === 0 ? (
          <div className="card px-5 py-8 text-center text-sm text-muted">This vehicle has never been checked at a gate.</div>
        ) : (
          <div className="card divide-y divide-line">
            {data.checks.map((c) => {
              const [label, tone] = VERDICTS[c.verdict] || [c.verdict, 'bg-shell text-muted'];
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm text-ink">{when(c.at)}</div>
                    <div className="truncate text-2xs text-muted">
                      {c.checkpost || 'unknown gate'}{c.staff ? ` · ${c.staff}` : ' · no staff member (recorded by the visitor)'}
                      {c.seconds != null ? ` · ${c.seconds}s` : ''}
                      {c.ticketNo ? ` · ${c.ticketNo}` : ''}
                    </div>
                  </div>
                  <span className={`chip shrink-0 ${tone}`}>{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Shell>
  );
}

/*
 * Who books this vehicle.
 *
 * A vehicle is not a person: the same car comes back on a different phone — a
 * family sharing it, a driver booking for an owner, a car sold last month — and
 * the count of how many different people have booked it is a fact somebody
 * checking a dispute wants first. So the count leads, and each name opens.
 *
 * WHAT OPENING ONE SHOWS is what this service legitimately knows: the name they
 * gave, the name WhatsApp shows, the last four digits of their number, how long
 * they have been a visitor, and what else they bring here.
 *
 * WHERE THEY ARE FROM IS THE VEHICLES', NOT THEIRS. The register says where a
 * vehicle was registered, and that is sourced and checkable. Where its driver
 * lives is not something anybody here is told, and inferring it from a mobile
 * number would be inventing a fact about a person — numbers are portable, and a
 * Delhi number says nothing about where its owner sleeps. The line is labelled
 * for what it is.
 */
function Bookers({ visitors, total }) {
  const [open, setOpen] = useState(null);
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold text-ink">
        Who books it
        <span className="ml-2 text-2xs font-normal text-muted">
          {number(total)} {total === 1 ? 'person has' : 'different people have'} booked this vehicle
        </span>
      </h2>
      <div className="card divide-y divide-line">
        {visitors.length === 0 && <div className="px-5 py-6 text-center text-sm text-muted">Nobody has booked it yet.</div>}
        {visitors.map((p, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-shell"
                onClick={() => setOpen(isOpen ? null : i)}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{p.name || p.waName || 'No name given'}</div>
                  <div className="truncate text-2xs text-muted">
                    {p.mobile} · {number(p.passes)} pass{p.passes === 1 ? '' : 'es'} on this vehicle · last {dayLabel(p.lastVisit)}
                  </div>
                </div>
                <span className="shrink-0 text-2xs text-muted">{isOpen ? 'Hide' : 'Details'}</span>
              </button>

              {isOpen && (
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 border-t border-line bg-shell px-5 py-3 text-sm">
                  <Row k="Name given" v={p.name || '—'} />
                  <Row k="On WhatsApp" v={p.waName || '—'} />
                  <Row k="Mobile" v={<span className="font-mono">{p.mobile}</span>} />
                  <Row k="Language" v={p.language === 'kn' ? 'Kannada' : p.language === 'en' ? 'English' : '—'} />
                  <Row k="This vehicle" v={`${number(p.passes)} pass${p.passes === 1 ? '' : 'es'}, ${number(p.entries)} entered`} />
                  <Row k="First booked it" v={p.firstVisit ? dayLabel(p.firstVisit) : '—'} />
                  <Row k="A visitor since" v={p.visitorSince ? when(p.visitorSince) : '—'} />
                  <Row k="Brings here" v={`${number(p.vehicles)} vehicle${p.vehicles === 1 ? '' : 's'} · ${number(p.allPasses)} pass${p.allPasses === 1 ? '' : 'es'} in all`} />
                  {p.otherVehicles.length > 0 && (
                    <Row k="Other vehicles" v={
                      <span className="flex flex-wrap gap-1">
                        {p.otherVehicles.map((r) => (
                          <a key={r} href={`/vehicles/${encodeURIComponent(r)}`} className="chip bg-shell font-mono text-ink hover:bg-line">{plate(r)}</a>
                        ))}
                      </span>} />
                  )}
                  {p.from.length > 0 && (
                    <Row k="Their vehicles are registered at" v={
                      <span className="block">
                        {p.from.join(' · ')}
                        <span className="mt-0.5 block text-2xs text-muted">
                          Where the vehicles come from, which is not necessarily where the person does.
                        </span>
                      </span>} />
                  )}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const Row = ({ k, v }) => (
  <>
    <dt className="whitespace-nowrap text-2xs uppercase tracking-wide text-muted">{k}</dt>
    <dd className="text-ink">{v}</dd>
  </>
);

const Stat = ({ label, value, note }) => (
  <div className="card px-4 py-3">
    <div className="text-2xs uppercase tracking-wide text-muted">{label}</div>
    <div className="mt-0.5 text-xl font-bold text-ink">{value}</div>
    {note ? <div className="text-2xs text-muted">{note}</div> : null}
  </div>
);

const Panel = ({ title, rows }) => (
  <section>
    <h2 className="mb-2 text-[15px] font-semibold text-ink">{title}</h2>
    <div className="card divide-y divide-line px-5">
      {rows.map(([k, val], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2">
          <span className="shrink-0 text-2xs uppercase tracking-wide text-muted">{k}</span>
          <span className="text-right text-sm text-ink">{val}</span>
        </div>
      ))}
    </div>
  </section>
);
