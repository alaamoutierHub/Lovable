import { describe, it, expect } from "vitest";
import { decidePlan } from "./decision";
import { computePromoMetrics, PromoInputs } from "../calc/plan";
import { checkDataQuality, DqInput } from "../dq/rules";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;

function build(planInput: Partial<PromoInputs>, dqInput: Partial<DqInput> = {}) {
  const input: PromoInputs = {
    baselineRevenue: 10000, baselineUnits: 1000,
    promoRevenue: 16000, promoUnits: 1400,
    investment: { mediaSpend: 1000 },
    ...planInput,
  } as PromoInputs;
  const metrics = computePromoMetrics(input, S);
  const dq = checkDataQuality(
    {
      baselineRevenue: input.baselineRevenue, baselineUnits: input.baselineUnits,
      promoRevenue: input.promoRevenue, promoUnits: input.promoUnits,
      normalPrice: 19, plannedPromoPrice: 15, forecastRevenue: 15000,
      currency: "AED", fundingSource: "supplier",
      startDate: "2026-08-01", endDate: "2026-08-14",
      ...dqInput,
    },
    metrics,
    S,
  );
  return { metrics, dq };
}

describe("decidePlan", () => {
  it("strong ROI + clean data => approve", () => {
    // incr = 6000, inv = 1000 => net ROI = 5.0
    const { metrics, dq } = build({});
    const r = decidePlan(metrics, dq, { strongRoi: 0.5, okRoi: 0 });
    expect(r.decision).toBe("approve");
  });

  it("blocking DQ error => reject", () => {
    const { metrics, dq } = build({ baselineRevenue: null }, { baselineRevenue: null, currency: null });
    const r = decidePlan(metrics, dq);
    expect(r.decision).toBe("reject");
  });

  it("negative incremental revenue => reject", () => {
    const { metrics, dq } = build({ promoRevenue: 8000 }); // incr = -2000
    const r = decidePlan(metrics, dq);
    expect(r.decision).toBe("reject");
  });

  it("ROI not calculable (zero investment) => revise", () => {
    const { metrics, dq } = build({ investment: { mediaSpend: 0 } });
    const r = decidePlan(metrics, dq);
    expect(r.decision).toBe("revise");
  });

  it("strong ROI but data warnings => test", () => {
    // add a warning via forecast < baseline (Q14) while keeping strong ROI
    const { metrics, dq } = build({}, { forecastRevenue: 5000 });
    const r = decidePlan(metrics, dq);
    expect(r.decision).toBe("test");
  });

  it("below break-even ROI => revise", () => {
    // incr = 500, inv = 1000 => net ROI = -0.5
    const { metrics, dq } = build({ promoRevenue: 10500 });
    const r = decidePlan(metrics, dq);
    expect(r.decision).toBe("revise");
  });
});
