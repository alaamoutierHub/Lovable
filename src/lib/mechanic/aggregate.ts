// PromoLift — Promotion Mechanic Analysis (docs module G).
// Groups saved plans by mechanic and re-derives ratios from summed numerators /
// denominators (finding V9), plus ASP dilution, cost-per-incremental-unit, and the
// best-performing channel for each mechanic. Reuses the tested rollup() engine.

import { rollup, type RollupRow } from "../calc/rollup";
import { DEFAULT_SETTINGS, type OrgSettings, type Calc } from "../calc/types";

export interface MechanicPlanRow {
  mechanicId: string | null;
  mechanicName: string;
  channelId?: string | null;
  channelName?: string;
  productId?: string | null;
  baselineRevenue?: number | null;
  promoRevenue?: number | null;
  baselineUnits?: number | null;
  promoUnits?: number | null;
  totalInvestment?: number | null;
}

export interface MechanicStats {
  mechanicId: string | null;
  mechanicName: string;
  campaigns: number;
  skus: number;
  incrementalRevenue: Calc;
  revenueRoi: Calc;
  revenueUpliftPct: Calc;
  unitUpliftPct: Calc;
  investmentIntensity: Calc;
  aspDilutionPct: number | null;
  costPerIncrementalUnit: number | null;
  bestChannel: string | null;
  totalInvestment: number;
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function toRollupRows(rows: MechanicPlanRow[]): RollupRow[] {
  return rows
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
}

/** Net ROI from summed numerators/denominators (matches rollup's net definition). */
function netRoi(rows: RollupRow[], settings: OrgSettings): number | null {
  const inv = rows.reduce((a, r) => a + r.totalInvestment, 0);
  if (inv === 0) return null;
  const incr = rows.reduce((a, r) => a + (r.promoRevenue - r.baselineRevenue), 0);
  return settings.roiDefinition === "net" ? (incr - inv) / inv : incr / inv;
}

export function aggregateByMechanic(
  rows: MechanicPlanRow[],
  settings: OrgSettings = DEFAULT_SETTINGS,
): MechanicStats[] {
  const groups = new Map<string, MechanicPlanRow[]>();
  for (const r of rows) {
    const key = r.mechanicId ?? "__none__";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const stats: MechanicStats[] = [];
  for (const [, group] of groups) {
    const rr = toRollupRows(group);
    const port = rollup(rr, settings);
    const sumInv = rr.reduce((a, r) => a + r.totalInvestment, 0);
    const sumBaseUnits = rr.reduce((a, r) => a + r.baselineUnits, 0);
    const sumPromoUnits = rr.reduce((a, r) => a + r.promoUnits, 0);
    const sumBaseRev = rr.reduce((a, r) => a + r.baselineRevenue, 0);
    const sumPromoRev = rr.reduce((a, r) => a + r.promoRevenue, 0);

    // ASP dilution from summed revenue/units.
    let aspDilutionPct: number | null = null;
    if (sumBaseUnits > 0 && sumPromoUnits > 0 && sumBaseRev > 0) {
      const baselineAsp = sumBaseRev / sumBaseUnits;
      const promoAsp = sumPromoRev / sumPromoUnits;
      aspDilutionPct = Math.max(0, -(promoAsp / baselineAsp - 1));
    }

    // Cost per incremental unit (Not Calculable when incremental units <= 0).
    const incrUnits = sumPromoUnits - sumBaseUnits;
    const costPerIncrementalUnit = incrUnits > 0 ? sumInv / incrUnits : null;

    // Best-performing channel for this mechanic (highest net ROI).
    const byChannel = new Map<string, { name: string; rows: RollupRow[] }>();
    for (const r of group) {
      if (!r.channelId) continue;
      const rrow = toRollupRows([r]);
      if (rrow.length === 0) continue;
      const entry = byChannel.get(r.channelId) ?? { name: r.channelName ?? "Channel", rows: [] };
      entry.rows.push(...rrow);
      byChannel.set(r.channelId, entry);
    }
    let bestChannel: string | null = null;
    let bestRoi = -Infinity;
    for (const [, e] of byChannel) {
      const roi = netRoi(e.rows, settings);
      if (roi != null && roi > bestRoi) { bestRoi = roi; bestChannel = e.name; }
    }

    stats.push({
      mechanicId: group[0].mechanicId,
      mechanicName: group[0].mechanicName,
      campaigns: group.length,
      skus: new Set(group.map((r) => r.productId).filter(Boolean)).size,
      incrementalRevenue: port.incrementalRevenue,
      revenueRoi: port.revenueRoi,
      revenueUpliftPct: port.revenueUpliftPct,
      unitUpliftPct: port.unitUpliftPct,
      investmentIntensity: port.investmentIntensity,
      aspDilutionPct,
      costPerIncrementalUnit,
      bestChannel,
      totalInvestment: sumInv,
    });
  }

  return stats.sort((a, b) => {
    const ra = a.revenueRoi.ok ? a.revenueRoi.value : -Infinity;
    const rb = b.revenueRoi.ok ? b.revenueRoi.value : -Infinity;
    return rb - ra;
  });
}
