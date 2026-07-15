// Commerly — SKU-Channel Matrix (docs module F).
// Aggregates saved plans into (SKU × Channel) cells, re-deriving ratios via the
// tested rollup() engine, and assigns a recommendation band with conditional
// formatting. Small-sample cells are capped at "Test & Learn" (guardrail G1).

import { rollup, type RollupRow } from "../calc/rollup";
import { DEFAULT_SETTINGS, type OrgSettings, type Calc } from "../calc/types";

export type MatrixBand = "scale" | "maintain" | "test" | "revise" | "stop" | "insufficient";

export interface MatrixPlanRow {
  channelId: string | null;
  channelName: string;
  productId: string | null;
  productName: string;
  baselineRevenue?: number | null;
  promoRevenue?: number | null;
  baselineUnits?: number | null;
  promoUnits?: number | null;
  totalInvestment?: number | null;
}

export interface MatrixCell {
  productId: string;
  channelId: string;
  campaigns: number;
  incrementalRevenue: Calc;
  revenueRoi: Calc;
  revenueUpliftPct: Calc;
  unitUpliftPct: Calc;
  totalInvestment: number;
  band: MatrixBand;
}

export interface MatrixResult {
  skus: { id: string; name: string }[];
  channels: { id: string; name: string }[];
  cells: Record<string, MatrixCell>; // key `${productId}|${channelId}`
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export const cellKey = (productId: string, channelId: string) => `${productId}|${channelId}`;

/** Deterministic cell classification. Small samples are capped at "insufficient"
 *  (never Scale/Maintain) per guardrail G1; non-positive incremental => stop. */
export function classifyCell(
  roi: Calc, incrementalRevenue: Calc, campaigns: number, settings: OrgSettings,
): MatrixBand {
  const incr = incrementalRevenue.ok ? incrementalRevenue.value : null;
  if (incr != null && incr <= 0) return "stop";
  if (campaigns < settings.minObservations) return "insufficient";
  if (!roi.ok) return "insufficient";
  if (roi.value >= 1.0) return "scale";
  if (roi.value >= 0.5) return "maintain";
  if (roi.value >= 0) return "test";
  if (roi.value >= -0.25) return "revise";
  return "stop";
}

export function buildMatrix(
  rows: MatrixPlanRow[],
  settings: OrgSettings = DEFAULT_SETTINGS,
): MatrixResult {
  const skuMap = new Map<string, string>();
  const chanMap = new Map<string, string>();
  const groups = new Map<string, MatrixPlanRow[]>();

  for (const r of rows) {
    if (!r.productId || !r.channelId) continue; // matrix needs both axes
    skuMap.set(r.productId, r.productName);
    chanMap.set(r.channelId, r.channelName);
    const key = cellKey(r.productId, r.channelId);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const cells: Record<string, MatrixCell> = {};
  for (const [key, group] of groups) {
    const rollupRows: RollupRow[] = group
      .filter(
        (r) =>
          isNum(r.baselineRevenue) && isNum(r.promoRevenue) &&
          isNum(r.baselineUnits) && isNum(r.promoUnits) && isNum(r.totalInvestment),
      )
      .map((r) => ({
        baselineRevenue: r.baselineRevenue as number,
        promoRevenue: r.promoRevenue as number,
        baselineUnits: r.baselineUnits as number,
        promoUnits: r.promoUnits as number,
        totalInvestment: r.totalInvestment as number,
      }));
    const port = rollup(rollupRows, settings);
    const sumInv = rollupRows.reduce((a, r) => a + r.totalInvestment, 0);
    cells[key] = {
      productId: group[0].productId!,
      channelId: group[0].channelId!,
      campaigns: group.length,
      incrementalRevenue: port.incrementalRevenue,
      revenueRoi: port.revenueRoi,
      revenueUpliftPct: port.revenueUpliftPct,
      unitUpliftPct: port.unitUpliftPct,
      totalInvestment: sumInv,
      band: classifyCell(port.revenueRoi, port.incrementalRevenue, group.length, settings),
    };
  }

  const skus = [...skuMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const channels = [...chanMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  return { skus, channels, cells };
}
