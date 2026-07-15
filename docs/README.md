# Commerly — Design Deliverables (Stage 0)

Foundational design artifacts for **Commerly — Multi-Channel Growth & Investment Planner**, produced
before implementation per the build brief (§21–§22). No COGS / margin / P&L — the platform is about
revenue growth, incremental sales, investment efficiency, forecast accuracy, and budget allocation.

| # | Document | Covers (initial deliverables) |
|---|---|---|
| 01 | [Architecture & Build Plan](01-architecture-and-build-plan.md) | Product architecture (1), page map (7), user flows (8), role matrix (9), integration architecture (10), MVP split (11), testing plan (12), risk register (13), step-by-step build plan (14) |
| 02 | [Database Schema](02-database-schema.sql) | Complete schema + RLS (2) |
| 03 | [Entity Relationship Map](03-erd.md) | ERD + data flow (3) |
| 04 | [Formulas & Data Quality](04-formulas-and-data-quality.md) | Formula dictionary (4), data quality rules (6), **formula validation findings V1–V10** |
| 05 | [Recommendation Engine](05-recommendation-engine.md) | Recommendation logic (5) |

## Status
**Stage 0 — design.** Implementation (Stage 1+) begins after sign-off on the open decisions in
[01 §10](01-architecture-and-build-plan.md#10-open-decisions-needing-your-sign-off-before-stage-1),
most importantly the formula findings **V1** (ROI net vs gross) and **V2** (planned vs forecast).

## Stack (proposed, Lovable-compatible)
React + Vite + TypeScript + Tailwind + shadcn/ui · Supabase (Auth/Postgres/Storage/RLS/Edge Functions) ·
TanStack Query · React Hook Form + Zod · Recharts · server-side AI (OpenAI/Anthropic) · PostHog · Sentry.
