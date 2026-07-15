import { describe, it, expect } from "vitest";
import {
  buildPlanPayloads, buildActualPayloads, targetByKey, normName, type Lookups,
} from "./importTargets";
import { templateCsv, templateHeader } from "./template";
import { autoMap, validateRows, type ImportSpec } from "./importSpec";

const lookups: Lookups = {
  channels: new Map([[normName("Amazon UAE"), "chan-1"]]),
  brands: new Map([[normName("Aquafina"), "brand-1"]]),
  products: new Map([[normName("SKU-1001"), "prod-1"]]),
  mechanics: new Map([[normName("20% Off"), "mech-1"]]),
};

describe("buildPlanPayloads", () => {
  it("resolves FKs, computes calc, and marks the plan a draft", () => {
    const rec = {
      channel: "Amazon UAE", brand: "Aquafina", sku_code: "SKU-1001", mechanic: "20% Off",
      currency: "AED", baseline_revenue: 10000, baseline_units: 1000,
      promo_revenue: 14000, promo_units: 1300, media_spend: 1000, supplier_funded: 300,
    };
    const { payloads, warnings } = buildPlanPayloads([rec], { lookups });
    expect(warnings).toHaveLength(0);
    const p = payloads[0] as any;
    expect(p.channel_id).toBe("chan-1");
    expect(p.brand_id).toBe("brand-1");
    expect(p.product_id).toBe("prod-1");
    expect(p.mechanic_id).toBe("mech-1");
    expect(p.status).toBe("draft");
    expect(typeof p.dq_score).toBe("number");
    // incremental revenue = 14000 - 10000 = 4000, so ROI is a finite number
    expect(p.calc).toBeTruthy();
    expect(p.calc.incrementalRevenue).toBe(4000);
    expect(typeof p.calc.revenueRoi).toBe("number");
    expect(p.calc.decision).toBeTruthy();
  });

  it("warns and nulls the FK when a name is not found", () => {
    const rec = { channel: "Unknown Co", baseline_revenue: 10000, promo_revenue: 12000 };
    const { payloads, warnings } = buildPlanPayloads([rec], { lookups });
    expect((payloads[0] as any).channel_id).toBeNull();
    expect(warnings.join(" ")).toMatch(/Channel "Unknown Co" not found/);
  });

  it("converts expected uplift % from a whole number to a ratio", () => {
    const rec = { baseline_revenue: 10000, promo_revenue: 14000, expected_uplift_pct: 40 };
    const p = buildPlanPayloads([rec], { lookups }).payloads[0] as any;
    expect(p.expected_sales_uplift_pct).toBeCloseTo(0.4, 6);
  });
});

describe("buildActualPayloads", () => {
  it("computes an outcome and parses boolean issue flags", () => {
    const rec = {
      currency: "AED", baseline_revenue: 10000, baseline_units: 1000,
      actual_sales: 13500, actual_units: 1250, media_spend: 1000,
      execution_issue: "true", stock_issue: "false",
    };
    const p = buildActualPayloads([rec]).payloads[0] as any;
    expect(typeof p.outcome_classification).toBe("string");
    expect(p.execution_issue).toBe(true);
    expect(p.stock_issue).toBe(false);
    expect(p.actual_sales).toBe(13500);
    expect(p.actual_media_spend).toBe(1000);
    expect(p.calc).toBeTruthy();
  });

  it("treats missing issue flags as false", () => {
    const rec = { baseline_revenue: 10000, actual_sales: 12000 };
    const p = buildActualPayloads([rec]).payloads[0] as any;
    expect(p.pricing_issue).toBe(false);
    expect(p.availability_issue).toBe(false);
  });
});

describe("templates", () => {
  it("channel template header uses labels with * for required", () => {
    const h = templateHeader(targetByKey("channels"));
    expect(h).toContain("Name*");
    expect(h).toContain("Code");
  });

  it("template includes example rows", () => {
    const csv = templateCsv(targetByKey("products"));
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("SKU code*");
    expect(lines.length).toBeGreaterThan(1);
    expect(csv).toContain("Aquafina 500ml");
  });

  it("template headers still auto-map back to fields (punctuation-tolerant)", () => {
    const target = targetByKey("channels");
    const spec: ImportSpec = { key: "channels" as any, label: target.label, fields: target.fields, uniqueField: "name" };
    const headers = ["Name*", "Code", "Country (ISO-2)"];
    const map = autoMap(spec, headers);
    expect(map.name).toBe("Name*");
    expect(map.code).toBe("Code");
    expect(map.country).toBe("Country (ISO-2)");
  });
});

describe("validateRows with no unique field (transactions) skips dedup", () => {
  it("does not crash and accepts duplicate rows", () => {
    const target = targetByKey("plans");
    const spec: ImportSpec = { key: "plans" as any, label: target.label, fields: target.fields, uniqueField: "" };
    const headers = ["Baseline revenue*", "Promotional revenue*"];
    const rows = [["10000", "14000"], ["10000", "14000"]]; // identical
    const map = autoMap(spec, headers);
    const res = validateRows(spec, headers, rows, map);
    expect(res.accepted).toHaveLength(2); // no "duplicate" rejection
  });
});
