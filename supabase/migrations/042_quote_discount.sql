-- 042_quote_discount.sql
-- Quotient-style quote-level discount, applied to the non-optional subtotal
-- before GST. The portal reads quotes rows for sent/accepted quotes already.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0;
