import { describe, it, expect } from "vitest";
import { buildManagementSummary, summaryToEmailText, type SummaryInput } from "./summary";

const base: SummaryInput = {
  reportingCurrency: "AED",
  portfolio: { incrementalRevenue: 12000, totalInvestment: 3600, revenueRoiNet: 2.33, campaigns: 3 },
  channels: [
    { name: "Amazon", roiNet: 2.33, incremental: 12000, campaigns: 3 },
    { name: "Noon", roiNet: 0.4, incremental: 2000, campaigns: 1 },
  ],
  recommendations: [
    { label: "Wipes · Amazon", band: "scale", score: 82, confidence: "high" },
    { label: "Wipes · Noon", band: "revise_reduce", score: 40, confidence: "low" },
    { label: "New · Careem", band: "test_and_learn", score: null, confidence: "insufficient" },
  ],
  shifts: [{ from: "Wipes · Noon", to: "Wipes · Amazon", amount: 5000 }],
};

describe("buildManagementSummary", () => {
  it("headline reflects incremental and ROI", () => {
    const s = buildManagementSummary(base);
    expect(s.headline).toMatch(/12,000/);
    expect(s.headline).toMatch(/2\.33/);
  });

  it("best investments surface scale/maintain, underperformers surface revise/stop", () => {
    const s = buildManagementSummary(base);
    expect(s.bestInvestments[0]).toMatch(/Wipes · Amazon/);
    expect(s.underperformers[0]).toMatch(/Wipes · Noon/);
  });

  it("channel priorities are ranked by net ROI", () => {
    const s = buildManagementSummary(base);
    expect(s.channelPriorities[0]).toMatch(/Amazon/);
    expect(s.channelPriorities[1]).toMatch(/Noon/);
  });

  it("flags low/insufficient confidence and Test & Learn as risks", () => {
    const s = buildManagementSummary(base);
    expect(s.risks.join(" ")).toMatch(/low\/insufficient/i);
    expect(s.risks.join(" ")).toMatch(/Test & Learn/i);
  });

  it("action plan includes a reallocation when shifts exist", () => {
    const s = buildManagementSummary(base);
    expect(s.actionPlan.join(" ")).toMatch(/Reallocate/i);
  });

  it("degrades gracefully with no ROI", () => {
    const s = buildManagementSummary({
      ...base,
      portfolio: { incrementalRevenue: null, totalInvestment: 0, revenueRoiNet: null, campaigns: 0 },
      recommendations: [], shifts: [],
    });
    expect(s.headline).toMatch(/add complete data/i);
    expect(s.bestInvestments[0]).toMatch(/gather more history/i);
  });

  it("email text contains all sections", () => {
    const txt = summaryToEmailText(buildManagementSummary(base));
    for (const h of ["Performance overview", "Best investments", "Channel priorities", "Action plan"]) {
      expect(txt).toContain(h);
    }
  });
});
