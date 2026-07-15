-- =====================================================================
-- Commerly — QA seed data (runs via `supabase db reset`, bypasses RLS).
-- A demo org + master data + sample promotion plans covering the edge
-- cases in docs/01 §7 (testing plan). Deterministic fixed UUIDs.
-- NOTE: memberships require a real auth user; add yourself after signup:
--   insert into organization_members(organization_id,user_id,role)
--   values ('00000000-0000-0000-0000-0000000000aa','<your-auth-uid>','owner');
-- =====================================================================

insert into organizations (id, name, reporting_currency) values
  ('00000000-0000-0000-0000-0000000000aa', 'Demo Commercial Co', 'AED')
on conflict (id) do nothing;

insert into org_settings (organization_id) values
  ('00000000-0000-0000-0000-0000000000aa')
on conflict (organization_id) do nothing;

-- ---- master data ----
insert into categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000c0001','00000000-0000-0000-0000-0000000000aa','Baby Care')
on conflict do nothing;

insert into brands (id, organization_id, category_id, name) values
  ('00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000c0001','BrightBaby')
on conflict do nothing;

insert into channels (id, organization_id, name, code, country) values
  ('00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-0000000000aa','Amazon','AMZ','AE'),
  ('00000000-0000-0000-0000-0000000f0002','00000000-0000-0000-0000-0000000000aa','Noon','NOON','AE'),
  ('00000000-0000-0000-0000-0000000f0003','00000000-0000-0000-0000-0000000000aa','Carrefour','CRF','AE')
on conflict do nothing;

insert into products (id, organization_id, brand_id, category_id, sku_code, name, normal_price, currency, listed_at) values
  ('00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000c0001','BB-WIPES-72','BrightBaby Wipes 72s',19.00,'AED','2023-01-01'),
  ('00000000-0000-0000-0000-0000000d0002','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000c0001','BB-DIAP-M','BrightBaby Diapers M',55.00,'AED','2026-06-01')
on conflict do nothing;

insert into promotion_mechanics (id, organization_id, name, code, default_funding) values
  ('00000000-0000-0000-0000-0000000e0001','00000000-0000-0000-0000-0000000000aa','Straight Discount','DISC','supplier'),
  ('00000000-0000-0000-0000-0000000e0002','00000000-0000-0000-0000-0000000000aa','BOGO','BOGO','supplier'),
  ('00000000-0000-0000-0000-0000000e0003','00000000-0000-0000-0000-0000000000aa','Sponsored Placement','SPON','media')
on conflict do nothing;

-- ---- sample promotion plans (raw inputs; calc computed by the engine on load) ----
-- Columns kept minimal to focus on the calculation-relevant fields.
insert into promotion_plans
  (id, organization_id, channel_id, brand_id, product_id, mechanic_id, currency,
   normal_price, planned_promo_price, expected_sales_uplift_pct,
   forecast_sales, target_sales, media_spend, supplier_funded, retailer_funded, funding_source,
   strategic_priority, status, notes)
values
  -- 1. Successful campaign
  ('00000000-0000-0000-0000-0000000a0001','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0001','AED',19,15,0.50,14000,16000,1000,300,0,'supplier',4,'evaluated','Strong repeat performer'),
  -- 2. Weak campaign
  ('00000000-0000-0000-0000-0000000a0002','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0002','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0001','AED',19,17,0.08,10800,12000,900,0,0,'media',2,'evaluated','Low uplift vs spend'),
  -- 3. Negative uplift
  ('00000000-0000-0000-0000-0000000a0003','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0003','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0002','AED',19,12,-0.20,8000,12000,1200,0,0,'supplier',1,'evaluated','Cannibalised baseline'),
  -- 4. Zero baseline (new listing period)
  ('00000000-0000-0000-0000-0000000a0004','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0002','00000000-0000-0000-0000-0000000e0003','AED',55,49,0.00,5000,6000,800,0,0,'media',3,'draft','New SKU, no baseline'),
  -- 5. New SKU / insufficient history
  ('00000000-0000-0000-0000-0000000a0005','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0002','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0002','00000000-0000-0000-0000-0000000e0001','AED',55,44,0.30,7000,8000,600,400,0,'mixed',3,'submitted','First promo for SKU'),
  -- 6. Heavy ASP dilution
  ('00000000-0000-0000-0000-0000000a0006','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0003','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0001','AED',19,9,0.70,17000,18000,500,700,0,'supplier',2,'evaluated','Deep cut, big ASP drop'),
  -- 7. High investment
  ('00000000-0000-0000-0000-0000000a0007','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0003','AED',19,16,0.25,12500,14000,6000,0,0,'media',5,'active','Mega-campaign spend'),
  -- 8. Retailer-funded
  ('00000000-0000-0000-0000-0000000a0008','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0002','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0001','AED',19,15,0.35,13500,14000,0,0,900,'retailer',3,'evaluated','Retailer-funded price support'),
  -- 9. Mixed-funded
  ('00000000-0000-0000-0000-0000000a0009','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0003','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0002','AED',19,14,0.40,14000,15000,700,300,400,'mixed',4,'evaluated','Supplier+retailer+media'),
  -- 10. Missing data (no forecast/uplift/investment)
  ('00000000-0000-0000-0000-0000000a0010','00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-0000000b0001','00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000e0001','AED',19,null,null,null,null,null,null,null,null,1,'draft','Deliberately incomplete for DQ testing')
on conflict do nothing;
