// PromoLift — Zod validation schemas for promotion inputs.
// Shared by the Planner form (client) and the Edge Function that persists + recomputes (server).
import { z } from "zod";

const money = z.number().finite().nonnegative();
const optMoney = money.nullish();
const pct = z.number().finite();
const optPct = pct.nullish();

export const investmentSchema = z.object({
  mediaSpend: optMoney,
  tradeSupport: optMoney,
  visibilityFees: optMoney,
  supplierFunded: optMoney,
  retailerFunded: optMoney,
  otherActivationCost: optMoney,
});

export const promotionPlanSchema = z
  .object({
    channelId: z.string().uuid().nullish(),
    brandId: z.string().uuid().nullish(),
    productId: z.string().uuid().nullish(),
    customerId: z.string().uuid().nullish(),
    mechanicId: z.string().uuid().nullish(),
    campaignId: z.string().uuid().nullish(),
    baselineId: z.string().uuid().nullish(),
    currency: z.string().length(3).default("AED"),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),

    normalPrice: optMoney,
    plannedPromoPrice: optMoney,
    plannedDiscountPct: optPct,
    expectedSalesUpliftPct: optPct,
    expectedUnitUpliftPct: optPct,

    baselineRevenue: optMoney,
    baselineUnits: optMoney,
    promoRevenue: optMoney,
    promoUnits: optMoney,
    forecastSales: optMoney,
    forecastUnits: optMoney,
    targetSales: optMoney,

    investment: investmentSchema.default({}),

    strategicPriority: z.number().int().min(1).max(5).nullish(),
    stockRisk: z.string().nullish(),
    notes: z.string().max(5000).nullish(),
  })
  .superRefine((v, ctx) => {
    // Q10 — end date must not precede start date.
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date is before start date." });
    }
    // Q05 — promo price above normal price (warning surfaced elsewhere; hard error only if grossly inverted).
    if (v.plannedPromoPrice != null && v.normalPrice != null && v.plannedPromoPrice > v.normalPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["plannedPromoPrice"],
        message: "Promo price is above normal price — confirm this is intended.",
      });
    }
  });

export type PromotionPlanInput = z.infer<typeof promotionPlanSchema>;

export const actualsSchema = z.object({
  planId: z.string().uuid().nullish(),
  currency: z.string().length(3).default("AED"),
  actualStart: z.string().nullish(),
  actualEnd: z.string().nullish(),
  actualSales: optMoney,
  actualUnits: optMoney,
  actualMediaSpend: optMoney,
  actualTradeSupport: optMoney,
  actualFees: optMoney,
  actualRetailerFunded: optMoney,
  actualSupplierFunded: optMoney,
  actualOtherCost: optMoney,
  stockIssue: z.boolean().default(false),
  availabilityIssue: z.boolean().default(false),
  pricingIssue: z.boolean().default(false),
  executionIssue: z.boolean().default(false),
  competitorActivity: z.string().nullish(),
  contextNotes: z.string().max(5000).nullish(),
});

export type ActualsInput = z.infer<typeof actualsSchema>;
