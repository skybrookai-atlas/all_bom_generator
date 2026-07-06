-- 041_line_item_images.sql
-- Client-visible image per quote line (Quotient shows item photos on quotes).
-- A dedicated column (not metadata) so the public view can expose it without
-- leaking the internal metadata blob.

ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE OR REPLACE VIEW quote_line_items_public AS
SELECT
  li.id,
  li.quote_id,
  li.sort_order,
  li.kind,
  li.title,
  li.description,
  li.quantity,
  li.unit,
  li.unit_price,
  li.is_optional,
  li.image_url
FROM quote_line_items li
JOIN quotes q ON q.id = li.quote_id
WHERE q.status IN ('sent', 'accepted');

GRANT SELECT ON quote_line_items_public TO anon, authenticated;
