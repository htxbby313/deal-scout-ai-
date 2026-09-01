"use client";
import { useMemo, useState } from "react";
import {
  analyzeDealStrategy,
  calculateWholesaleDecision,
  estimateRehab,
  REHAB_CATEGORIES,
  type DealStrategy,
  type RehabMode,
} from "@/lib/deal-analysis";

const cents = (value: string) =>
  BigInt(Math.max(0, Math.round((Number(value) || 0) * 100)));
const money = (value: bigint | null) =>
  value == null
    ? "Insufficient verified data"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value / BigInt(100));
export function DealAnalysisCalculator({
  verifiedExitLowCents,
  verifiedExitBaseCents,
  verifiedExitHighCents,
  defaultAcquisitionCents,
}: {
  verifiedExitLowCents: string | null;
  verifiedExitBaseCents: string | null;
  verifiedExitHighCents: string | null;
  defaultAcquisitionCents: string | null;
}) {
  const [strategy, setStrategy] = useState<DealStrategy>("WHOLESALE");
  const [mode, setMode] = useState<RehabMode>("COSMETIC");
  const [rate, setRate] = useState("25");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [squareFeet, setSquareFeet] = useState("");
  const [acquisition, setAcquisition] = useState(
    defaultAcquisitionCents
      ? String(Number(defaultAcquisitionCents) / 100)
      : "",
  );
  const [transactionCosts, setTransactionCosts] = useState("");
  const [financingCosts, setFinancingCosts] = useState("");
  const [holdingCosts, setHoldingCosts] = useState("");
  const [assignmentFee, setAssignmentFee] = useState("15000");
  const [buyerAllowance, setBuyerAllowance] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const rehab = useMemo(
    () =>
      estimateRehab({
        mode,
        squareFeet: Number(squareFeet) || 0,
        ratePerSquareFootCents: cents(rate),
        customCents: Object.fromEntries(
          REHAB_CATEGORIES.map((category) => [
            category,
            cents(custom[category] || "0"),
          ]),
        ),
      }),
    [mode, squareFeet, rate, custom],
  );
  const result = useMemo(
    () =>
      analyzeDealStrategy({
        strategy,
        acquisitionCents: cents(acquisition),
        verifiedExitLowCents: verifiedExitLowCents
          ? BigInt(verifiedExitLowCents)
          : null,
        verifiedExitBaseCents: verifiedExitBaseCents
          ? BigInt(verifiedExitBaseCents)
          : null,
        verifiedExitHighCents: verifiedExitHighCents
          ? BigInt(verifiedExitHighCents)
          : null,
        rehabCents: rehab.totalCents,
        transactionCostsCents: cents(transactionCosts),
        financingCostsCents: cents(financingCosts),
        holdingCostsCents: cents(holdingCosts),
        monthlyRentCents: cents(monthlyRent),
        monthlyExpensesCents: cents(monthlyExpenses),
      }),
    [
      strategy,
      acquisition,
      verifiedExitLowCents,
      verifiedExitBaseCents,
      verifiedExitHighCents,
      rehab.totalCents,
      transactionCosts,
      financingCosts,
      holdingCosts,
      monthlyRent,
      monthlyExpenses,
    ],
  );
  const wholesaleDecision = useMemo(() => calculateWholesaleDecision({
    afterRepairValueCents: verifiedExitBaseCents ? BigInt(verifiedExitBaseCents) : null,
    repairsCents: rehab.totalCents,
    desiredAssignmentFeeCents: cents(assignmentFee),
    buyerAllowanceCents: cents(buyerAllowance),
    sellerAskingPriceCents: cents(acquisition),
  }), [verifiedExitBaseCents, rehab.totalCents, assignmentFee, buyerAllowance, acquisition]);
  const decisionLabels = {
    STRONG_DEAL: "Strong deal",
    WORTH_CONTACTING: "Worth contacting",
    NEEDS_BETTER_NUMBERS: "Needs better numbers",
    LIKELY_PASS: "Likely pass",
  } as const;
  return (
    <div>
      <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Decision summary</p>
        <h3 className="mt-1 text-2xl font-bold">{decisionLabels[wholesaleDecision.decision]}</h3>
        <p className="mt-2 text-sm text-slate-600">This projection uses the sourced base exit value and your editable assumptions. It is not a verified offer or guaranteed profit.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Card label="Maximum allowable offer" value={money(wholesaleDecision.maximumAllowableOfferCents)} /><Card label="Room below asking price" value={money(wholesaleDecision.expectedSpreadCents)} /></div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Strategy"
          value={strategy}
          onChange={(value) => setStrategy(value as DealStrategy)}
          options={["WHOLESALE", "WHOLETAIL", "FLIP", "CREATIVE", "BRRRR", "RENTAL", "PASS"]}
        />
        <Select
          label="Rehab level"
          value={mode}
          onChange={(value) => {
            const next = value as RehabMode;
            setMode(next);
            if (next !== "CUSTOM")
              setRate(
                next === "COSMETIC" ? "25" : next === "MODERATE" ? "50" : "90",
              );
          }}
          options={["COSMETIC", "MODERATE", "HEAVY", "CUSTOM"]}
        />
        <Input
          label="Square feet"
          value={squareFeet}
          onChange={setSquareFeet}
        />
        {mode !== "CUSTOM" ? (
          <Input
            label="Editable rehab $/sq ft"
            value={rate}
            onChange={setRate}
          />
        ) : null}
        <Input
          label="Seller asking price"
          value={acquisition}
          onChange={setAcquisition}
        />
        <Input label="Desired assignment fee" value={assignmentFee} onChange={setAssignmentFee} />
        <Input label="Buyer closing / holding allowance" value={buyerAllowance} onChange={setBuyerAllowance} />
        <Input
          label="Transaction costs"
          value={transactionCosts}
          onChange={setTransactionCosts}
        />
        <Input
          label="Financing costs"
          value={financingCosts}
          onChange={setFinancingCosts}
        />
        <Input
          label="Holding costs"
          value={holdingCosts}
          onChange={setHoldingCosts}
        />
        {["BRRRR", "RENTAL"].includes(strategy) ? (
          <>
            <Input
              label="Monthly rent"
              value={monthlyRent}
              onChange={setMonthlyRent}
            />
            <Input
              label="Monthly expenses"
              value={monthlyExpenses}
              onChange={setMonthlyExpenses}
            />
          </>
        ) : null}
      </div>
      {mode === "CUSTOM" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REHAB_CATEGORIES.map((category) => (
            <Input
              key={category}
              label={category.replaceAll("_", " ")}
              value={custom[category] || ""}
              onChange={(value) =>
                setCustom((current) => ({ ...current, [category]: value }))
              }
            />
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card label="Rehab estimate" value={money(rehab.totalCents)} />
        <Card label="Low outcome" value={money(result.lowCents)} />
        <Card label="Base outcome" value={money(result.baseCents)} />
        <Card label="High outcome" value={money(result.highCents)} />
      </div>
      <p className="mt-3 text-sm font-bold">
        {result.status.replaceAll("_", " ")}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {rehab.disclaimer} {result.explanation.join(" ")} Results are
        projections, not guaranteed revenue.
      </p>
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input
        className="rounded-lg border px-3 py-2 font-normal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        step="0.01"
        type="number"
        value={value}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <select
        className="rounded-lg border px-3 py-2 font-normal"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <b>{value}</b>
    </div>
  );
}
