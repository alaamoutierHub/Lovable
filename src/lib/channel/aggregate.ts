// PromoLift — Channel Comparison aggregation (docs module E).
// Groups saved plans by channel and re-derives portfolio ratios from summed
// numerators/denominators (finding V9) by reusing the tested rollup() engine.

import { rollup, type RollupRow } from "../calc/rollup";
import { DEFAULT_SETTINGS, type OrgSettings, type Calc } from "../calc/types";

/** One saved plan's raw figures, as persisted in promotion_plans.calc. */
export interface PlanRow {
  channelId: string | null;
  channelName: string;
  productId?: string | null;
  baselineRevenue?: number | null;
  promoRevenue?: number | null;
  baselineUnits?: number | null;
  promoUnits?: number | null;
  totalInvestment?: number | null;
}

export interface ChannelStats {
  channelId: string | null;
  channelName: string;
  campaigns: number;
  skus: number;
  incrementalRevenue: Calc;
  revenueRoi: Calc;
  incrementalRevenuePerAed: Calc;
  investmentIntensity: Calc;
  revenueUpliftPct: Calc;
  unitUpliftPct: Calc;
  totalInvestment: number;
  promoRevenue: number;
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function aggregateByChannel(
  rows: PlanRow[],
  settings: OrgSettings = DEFAULT_SETTINGS,
): ChannelStats[] {
  const groups = new Map<string, PlanRow[]>();
  for (const r of rows) {
    const key = r.channelId ?? "__none__";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const stats: ChannelStats[] = [];
  for (const [, group] of groups) {
    // Rows usable for ratio re-derivation need all five numeric fields.
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
    const skus = new Set(group.map((r) => r.productId).filter(Boolean)).size;
    const sumInv = rollupRows.reduce((a, r) => a + r.totalInvestment, 0);
    const sumPromo = rollupRows.reduce((a, r) => a + r.promoRevenue, 0);

    stats.push({
      channelId: group[0].channelId,
      channelName: group[0].channelName,
      campaigns: group.length,
      skus,
      incrementalRevenue: port.incrementalRevenue,
      revenueRoi: port.revenueRoi,
      incrementalRevenuePerAed: port.incrementalRevenuePerAed,
      investmentIntensity: port.investmentIntensity,
      revenueUpliftPct: port.revenueUpliftPct,
      unitUpliftPct: port.unitUpliftPct,
      totalInvestment: sumInv,
      promoRevenue: sumPromo,
    });
  }

  // Default rank: net ROI desc; NOT_CALCULABLE sinks to the bottom.
  return stats.sort((a, b) => {
    const ra = a.revenueRoi.ok ? a.revenueRoi.value : -Infinity;
    const rb = b.revenueRoi.ok ? b.revenueRoi.value : -Infinity;
    return rb - ra;
  });
}
