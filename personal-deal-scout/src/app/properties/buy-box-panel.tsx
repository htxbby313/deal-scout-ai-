import { saveBuyBoxAction, scanBuyBoxAction } from "@/app/buy-box-actions";

type SavedBox = {
  id: string;
  name: string;
  active: boolean;
  naturalLanguage: string | null;
  cities: string[];
  states: string[];
  maxPriceCents: bigint | null;
};

const dollars = (cents: bigint | null) =>
  cents == null
    ? null
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(cents) / 100);

export function BuyBoxPanel({ boxes }: { boxes: SavedBox[] }) {
  return (
    <details className="mt-6 rounded-2xl border bg-white p-5" id="buy-boxes">
      <summary className="cursor-pointer font-bold">Buy Boxes</summary>
      <p className="mt-2 text-sm text-slate-600">
        Describe what you want. Scout matches cached properties only, attaches
        them as Deals, and puts them on Home. No paid enrichment. Not a second
        search app.
      </p>
      <form action={saveBuyBoxAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          In plain English
          <input
            className="rounded-xl border px-3 py-2 font-normal"
            name="prompt"
            placeholder='Find 3/2 houses in Meridian under $200,000 with at least $25,000 spread'
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Name
          <input className="rounded-xl border px-3 py-2 font-normal" name="name" placeholder="Meridian SFR" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          City
          <input className="rounded-xl border px-3 py-2 font-normal" name="cities" placeholder="Meridian" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          State
          <input className="rounded-xl border px-3 py-2 font-normal" name="states" placeholder="ID" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          ZIP
          <input className="rounded-xl border px-3 py-2 font-normal" name="zipCodes" placeholder="83642" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Property types
          <input className="rounded-xl border px-3 py-2 font-normal" name="propertyTypes" placeholder="SFR" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Max price
          <input className="rounded-xl border px-3 py-2 font-normal" name="maxPrice" placeholder="200000" type="number" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Min price
          <input className="rounded-xl border px-3 py-2 font-normal" name="minPrice" placeholder="" type="number" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Min spread
          <input className="rounded-xl border px-3 py-2 font-normal" name="minSpread" placeholder="25000" type="number" />
        </label>
        <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white sm:col-span-2">
          Save and attach matching Deals
        </button>
      </form>
      {boxes.length ? (
        <div className="mt-5 divide-y">
          {boxes.map((box) => (
            <article className="flex flex-wrap items-center justify-between gap-3 py-3" key={box.id}>
              <div>
                <p className="font-bold">{box.name}</p>
                <p className="text-xs text-slate-500">
                  {[box.cities.join(", "), box.states.join(", "), dollars(box.maxPriceCents)]
                    .filter(Boolean)
                    .join(" · ") || box.naturalLanguage}
                </p>
              </div>
              {box.active ? (
                <form action={scanBuyBoxAction}>
                  <input name="buyBoxId" type="hidden" value={box.id} />
                  <button className="rounded-lg border px-3 py-2 text-sm font-bold">
                    Scan cached properties
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </details>
  );
}
