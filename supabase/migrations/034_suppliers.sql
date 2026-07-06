-- 034_suppliers.sql
-- Supplier layer for the multi-supplier quoting platform.
--
-- Two tiers of supplier data:
--   1. suppliers            — who we buy from (all 15+ suppliers)
--   2. supplier_items       — raw price-list catalogue (quotable directly on a
--                             quote line; NOT engine components). Imported from
--                             supplier price lists / Xero bills.
-- Engine components (product_components) gain an optional supplier_id so
-- calculator seed packs can attribute each SKU to the supplier it's bought from,
-- and generic calculators (COLORBOND, TP_PALING, ...) can offer a supplier choice.

-- 1. suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,                        -- e.g. 'glass-outlet', 'stratco'
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB,        -- contact details, account no, notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);

-- Staff need the supplier list for dropdowns/filters (names only — no pricing here).
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated select suppliers" ON suppliers
  FOR SELECT TO authenticated
  USING (org_id = public.user_org_id());
CREATE POLICY "Allow authenticated suppliers CRUD" ON suppliers
  FOR ALL TO authenticated
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- 2. supplier_items — the price-list catalogue tier.
-- Contains supplier COST prices (sensitive IP): service-role only, same pattern
-- as product_components / pricing_rules. Client search goes through an edge
-- function that controls what is exposed.
CREATE TABLE IF NOT EXISTS supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku TEXT,                                  -- supplier order code (may be absent)
  description TEXT NOT NULL,
  category TEXT,                             -- e.g. 'Panels and Cladding', 'Posts'
  system TEXT,                               -- supplier system/range name
  colour TEXT,
  material TEXT,
  unit TEXT DEFAULT 'each',
  price NUMERIC(12,2) NOT NULL,              -- supplier cost price ex-GST
  source TEXT,                               -- provenance: 'quotient-replica-import', 'xero-bill', ...
  source_key TEXT NOT NULL,                  -- stable natural key for idempotent re-imports
  imported_date TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB,
  UNIQUE (org_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_supplier_items_org_supplier ON supplier_items(org_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_category ON supplier_items(org_id, category);

-- Trigram index for catalogue search (ilike '%...%' in the search edge function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_supplier_items_description_trgm
  ON supplier_items USING GIN (description gin_trgm_ops);

-- NO RLS policies — cost prices are IP. Service role only.
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON supplier_items FROM anon, authenticated;

-- 3. Attribute engine components to a supplier (nullable; existing rows = Glass Outlet,
-- backfilled by seed tooling rather than hardcoding a UUID here).
ALTER TABLE product_components
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_components_supplier ON product_components(supplier_id);
