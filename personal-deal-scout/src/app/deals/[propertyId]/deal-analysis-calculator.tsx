"use client";
import { useMemo, useState } from "react";
import { saveDealAssumptionsAction } from "@/app/deal-analysis-actions";
import {
  analyzeDealStrategy,
  estimateRehab,
  REHAB_CATEGORIES,
  type DealStrategy,
  type RehabMode,
} from "@/lib/deal-analysis";
import type { DealAssumptionsRecord } from "@/lib/deal-assumptions";

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
/** JSON-persisted cents string ("12345") -> dollar input value ("123.45"). */
const dollarsFromCentsString = (value: string | null | undefined) =>
  value ? String(Number(value) / 100) : "";
export function DealAnalysisCalculator({
  propertyId,
  verifiedExitLowCents,
  verifiedExitBaseCents,
  verifiedExitHighCents,
  defaultAcquisitionCents,
  initialAssumptions,
}: {
  propertyId: string;
  verifiedExitLowCents: string | null;
  verifiedExitBaseCents: string | null;
  verifiedExitHighCents: string | null;
  defaultAcquisitionCents: string | null;
  initialAssumptions: DealAssumptionsRecord | null;
}) {
  const [strategy, setStrategy] = useState<DealStrategy>(
    initialAssumptions?.strategy ?? "WHOLESALE",
  );
  const [mode, setMode] = useState<RehabMode>(
    initialAssumptions?.rehabMode ?? "COSMETIC",
  );
  const [rate, setRate] = useState(
    initialAssumptions
      ? dollarsFromCentsString(initialAssumptions.ratePerSquareFootCents) ||
          "25"
      : "25",
  );
  const [custom, setCustom] = useState<Record<string, string>>(
    initialAssumptions?.customCents
      ? Object.fromEntries(
          Object.entries(initialAssumptions.customCents).map(
            ([category, centsValue]) => [
              category,
              dollarsFromCentsString(centsValue),
            ],
          ),
        )
      : {},
  );
  const [squareFeet, setSquareFeet] = useState(
    initialAssumptions?.squareFeet != null
      ? String(initialAssumptions.squareFeet)
      : "",
  );
  const [acquisition, setAcquisition] = useState(
    initialAssumptions?.acquisitionCents
      ? dollarsFromCentsString(initialAssumptions.acquisitionCents)
      : defaultAcquisitionCents
        ? String(Number(defaultAcquisitionCents) / 100)
        : "",
  );
  const [transactionCosts, setTransactionCosts] = useState(
    dollarsFromCentsString(initialAssumptions?.transactionCostsCents),
  );
  const [financingCosts, setFinancingCosts] = useState(
    dollarsFromCentsString(initialAssumptions?.financingCostsCents),
  );
  const [holdingCosts, setHoldingCosts] = useState(
    dollarsFromCentsString(initialAssumptions?.holdingCostsCents),
  );
  const [monthlyRent, setMonthlyRent] = useState(
    dollarsFromCentsString(initialAssumptions?.monthlyRentCents),
  );
  const [monthlyExpenses, setMonthlyExpenses] = useState(
    dollarsFromCentsString(initialAssumptions?.monthlyExpensesCents),
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
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
  const handleSave = async () => {
    setSaveState("saving");
    try {
      const formData = new FormData();
      formData.set("propertyId", propertyId);
      formData.set("strategy", strategy);
      formData.set("rehabMode", mode);
      formData.set("squareFeet", squareFeet);
      formData.set("ratePerSquareFootCents", rate);
      formData.set("acquisitionCents", acquisition);
      formData.set("transactionCostsCents", transactionCosts);
      formData.set("financingCostsCents", financingCosts);
      formData.set("holdingCostsCents", holdingCosts);
      formData.set("monthlyRentCents", monthlyRent);
      formData.set("monthlyExpensesCents", monthlyExpenses);
      if (mode === "CUSTOM") {
        for (const category of REHAB_CATEGORIES) {
          formData.set(`custom_${category}`, custom[category] || "0");
        }
      }
      await saveDealAssumptionsAction(formData);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Strategy"
          value={strategy}
          onChange={(value) => setStrategy(value as DealStrategy)}
          options={["WHOLESALE", "FLIP", "BRRRR", "RENTAL"]}
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
          label="Acquisition price"
          value={acquisition}
          onChange={setAcquisition}
        />
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
        projections, not guaranteed revenue. Rehab is an estimate, not a
        contractor bid, and never changes the seller-safe maximum or
        assignment projected spread above.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          disabled={saveState === "saving"}
          onClick={handleSave}
          type="button"
        >
          {saveState === "saving" ? "Saving…" : "Save rehab & strategy"}
        </button>
        {saveState === "saved" ? (
          <span className="text-sm font-semibold text-emerald-700">
            Saved to this Deal. It will still be here next time you open it.
          </span>
        ) : null}
        {saveState === "error" ? (
          <span className="text-sm font-semibold text-red-700">
            Could not save. Try again.
          </span>
        ) : null}
      </div>
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
