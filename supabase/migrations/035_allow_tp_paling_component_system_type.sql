-- Allow 'TP_PALING' in product_components.system_types, mirroring the
-- COLORBOND extension in 031_allow_colorbond_component_system_type.sql.
-- Needed by the Treated Pine paling fence seed pack
-- (supabase/seeds/glass-outlet/products/tp_paling.json).

ALTER TABLE product_components
  DROP CONSTRAINT IF EXISTS chk_system_types_values;

ALTER TABLE product_components
  ADD CONSTRAINT chk_system_types_values
  CHECK (system_types <@ ARRAY['QSHS','VS','XPL','BAYG','COLORBOND','TP_PALING','GATE']::TEXT[]);
