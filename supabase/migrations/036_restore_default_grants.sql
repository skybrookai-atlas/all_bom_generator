-- 036_restore_default_grants.sql
--
-- Newer Supabase CLI local images (postgres 15.8.1.085 / CLI 2.108+) changed the
-- default privileges for tables created by migrations: anon / authenticated /
-- service_role now only receive TRUNCATE/REFERENCES/TRIGGER instead of full DML.
-- This codebase was built against the classic defaults (full grants + targeted
-- REVOKEs on sensitive tables), and the seed upserter + edge functions rely on
-- service_role having table access.
--
-- Restore the classic grants. Safety note: every sensitive table already has
-- RLS enabled (deny-by-default without policies), so client-role grants are
-- gated by policies. The only RLS-incapable object is the pricing_rules_with_sku
-- VIEW, which is re-revoked below.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Future tables/sequences/functions created by the postgres role get the same.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Re-apply the intended client lockdowns that blanket grants above would undo.
-- (RLS-enabled tables are already deny-by-default; this view is the exception.)
REVOKE ALL ON pricing_rules_with_sku FROM anon, authenticated;
