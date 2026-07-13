import { describe, it, expect } from "vitest";
import { parseCsv } from "./parseCsv";
import { specFor, autoMap, validateRows, rejectedToCsv } from "./importSpec";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const r = parseCsv("name,code\nAmazon,AMZ\nNoon,NOON");
    expect(r.headers).toEqual(["name", "code"]);
    expect(r.rows).toEqual([["Amazon", "AMZ"], ["Noon", "NOON"]]);
  });
  it("handles quoted fields with commas and escaped quotes", () => {
    const r = parseCsv('name,note\n"Careem, Quik","He said ""hi"""');
    expect(r.rows[0]).toEqual(["Careem, Quik", 'He said "hi"']);
  });
  it("handles CRLF and trailing blank line", () => {
    const r = parseCsv("name\r\nA\r\nB\r\n");
    expect(r.headers).toEqual(["name"]);
    expect(r.rows).toEqual([["A"], ["B"]]);
  });
  it("supports embedded newlines inside quotes", () => {
    const r = parseCsv('name,desc\nA,"line1\nline2"');
    expect(r.rows[0]).toEqual(["A", "line1\nline2"]);
  });
});

describe("autoMap", () => {
  it("matches headers to fields ignoring case/spacing", () => {
    const spec = specFor("channels");
    const map = autoMap(spec, ["Name", "Code", "Country (ISO-2)"]);
    expect(map.name).toBe("Name");
    expect(map.code).toBe("Code");
  });
});

describe("validateRows", () => {
  const spec = specFor("products"); // sku_code (req), name (req), normal_price (num), currency
  const headers = ["sku_code", "name", "normal_price", "currency"];
  const map = { sku_code: "sku_code", name: "name", normal_price: "normal_price", currency: "currency" };

  it("accepts valid rows and coerces numbers", () => {
    const r = validateRows(spec, headers, [["BB-1", "Wipes", "19", "AED"]], map);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0].normal_price).toBe(19);
    expect(r.rejected).toHaveLength(0);
  });

  it("rejects rows missing a required field with a reason", () => {
    const r = validateRows(spec, headers, [["", "Wipes", "19", "AED"]], map);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].errors.join()).toMatch(/required/i);
    expect(r.rejected[0].rowNumber).toBe(2);
  });

  it("rejects non-numeric and negative numbers", () => {
    const bad = validateRows(spec, headers, [["BB-1", "W", "abc", "AED"]], map);
    expect(bad.rejected[0].errors.join()).toMatch(/must be a number/i);
    const neg = validateRows(spec, headers, [["BB-2", "W", "-5", "AED"]], map);
    expect(neg.rejected[0].errors.join()).toMatch(/negative/i);
  });

  it("flags in-file duplicates on the unique field", () => {
    const r = validateRows(spec, headers, [["BB-1", "A", "", ""], ["BB-1", "B", "", ""]], map);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0].errors.join()).toMatch(/duplicate/i);
  });

  it("flags rows colliding with existing keys", () => {
    const r = validateRows(spec, headers, [["BB-1", "A", "", ""]], map, new Set(["bb-1"]));
    expect(r.rejected[0].errors.join()).toMatch(/already exists/i);
  });
});

describe("rejectedToCsv", () => {
  it("re-serializes rejected rows with an _errors column", () => {
    const spec = specFor("channels");
    const r = validateRows(spec, ["name"], [["  "]], { name: "name" });
    const csv = rejectedToCsv(spec, r.rejected);
    expect(csv.split("\n")[0]).toContain("_errors");
    expect(csv).toMatch(/required/i);
  });
});
