-- 039_quote_library_and_headings.sql
-- Quotient-style quote writing:
--   1. heading / text line kinds — structure-only rows (no pricing)
--   2. quote_library_items — the reusable priced-item library (imported from
--      the owner's real Quotient price item library)

-- 1. Extend line kinds
ALTER TABLE quote_line_items DROP CONSTRAINT IF EXISTS quote_line_items_kind_check;
ALTER TABLE quote_line_items
  ADD CONSTRAINT quote_line_items_kind_check
  CHECK (kind IN ('calculated', 'catalogue', 'manual', 'library', 'heading', 'text'));

-- 2. Price item library
CREATE TABLE IF NOT EXISTS quote_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',                    -- client-facing description (bullet specs)
  unit TEXT DEFAULT 'each',
  unit_price NUMERIC NOT NULL DEFAULT 0,   -- sell price ex GST
  categories TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  source_quote_item_id BIGINT,             -- Quotient quote_item_id for provenance
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, source_quote_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_library_items_org ON quote_library_items(org_id, active);

ALTER TABLE quote_library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated library CRUD" ON quote_library_items
  FOR ALL TO authenticated
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- Sell prices are not costs, but the library is still internal business data.
REVOKE ALL ON quote_library_items FROM anon;

DROP TRIGGER IF EXISTS trg_quote_library_items_updated_at ON quote_library_items;
CREATE TRIGGER trg_quote_library_items_updated_at
  BEFORE UPDATE ON quote_library_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
