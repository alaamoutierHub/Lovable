// PromoLift deterministic calculation engine — shared types.
// Runs identically on client (preview) and server (source of truth).
// No randomness, no Date.now, no floating-point order sensitivity in aggregates.

/** Sentinel for a value that cannot be computed from the given inputs. */
export const NOT_CALCULABLE = "NOT_CALCULABLE" as const;
export type NotCalculable = typeof NOT_CALCULABLE;

/** A metric result is either a finite number or NOT_CALCULABLE with a reason. */
export type Calc =
  | { ok: true; value: number }
  | { ok: false; value: NotCalculable; reason: string };

export const ok = (value: number): Calc => ({ ok: true, value });
export const nc = (reason: string): Calc => ({ ok: false, value: NOT_CALCULABLE, reason });

/** Organization-level settings that change formula behaviour (see docs/02 org_settings). */
export interface OrgSettings {
  /** Include retailer-funded support in Total Investment (finding V8 / F8). */
  includeRetailerFundingInInvestment: boolean;
  /** 'net' => (incr - inv)/inv ; 'gross' => incr/inv  (finding V1). */
  roiDefinition: "net" | "gross";
  /** 'planned' => Baseline*(1+uplift) drives forecast ; 'forecast' => explicit field (finding V2). */
  primaryForecastSource: "planned" | "forecast";
  /** Warn when planned vs forecast diverge beyond this fraction (finding V2). */
  forecastVsPlannedTolerancePct: number;
  /** Data-quality: uplift above this fraction is flagged extreme (Q12). */
  extremeUpliftPct: number;
  /** Data-quality: ASP dilution above this fraction is flagged extreme (Q13). */
  extremeDilutionPct: number;
}

export const DEFAULT_SETTINGS: OrgSettings = {
  includeRetailerFundingInInvestment: false,
  roiDefinition: "net",
  primaryForecastSource: "planned",
  forecastVsPlannedTolerancePct: 0.1,
  extremeUpliftPct: 3.0,
  extremeDilutionPct: 0.6,
};

/** Nullable finite number — anything not a finite number is treated as "missing". */
export type Num = number | null | undefined;

export const isNum = (x: Num): x is number =>
  typeof x === "number" && Number.isFinite(x);
