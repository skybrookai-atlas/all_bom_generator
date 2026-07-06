## 2026-06-30T04:46:12Z

Create the Supabase migration file `supabase/migrations/033_quotient_integration.sql` that implements the database schema requirements.

Requirements:
1. Create `installers` table:
   - Columns: `id` (UUID PRIMARY KEY DEFAULT gen_random_uuid()), `org_id` (UUID REFERENCES organisations(id) ON DELETE CASCADE), `name` (TEXT NOT NULL), `email` (TEXT), `phone` (TEXT), `status` (TEXT CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active'), `created_at` (TIMESTAMPTZ DEFAULT NOW()).
   - RLS: Enable RLS. Add policy allowing public/authenticated CRUD (USING (true) WITH CHECK (true)) so there are no issues during testing.
2. Create `quote_settings` table:
   - Columns: `id` (UUID PRIMARY KEY DEFAULT gen_random_uuid()), `org_id` (UUID REFERENCES organisations(id) ON DELETE CASCADE UNIQUE), `logo_url` (TEXT), `primary_color` (TEXT), `secondary_color` (TEXT), `default_deposit` (NUMERIC DEFAULT 15), `xero_enabled` (BOOLEAN DEFAULT false), `created_at` (TIMESTAMPTZ DEFAULT NOW()).
   - RLS: Enable RLS. Add policy allowing public/authenticated CRUD.
3. Alter `quotes` table:
   - Add columns:
     - `assigned_installer_id` (UUID REFERENCES installers(id) ON DELETE SET NULL)
     - `install_date` (DATE)
     - `use_splits` (BOOLEAN DEFAULT false)
     - `split_ratio_a` (NUMERIC DEFAULT 50)
     - `split_ratio_b` (NUMERIC DEFAULT 50)
     - `xero_invoice_id` (TEXT)
     - `xero_sync_status` (TEXT DEFAULT 'Unsynced')
4. Alter `quote_comments` table:
   - Add column: `is_private` (BOOLEAN DEFAULT false).
   - Check if there is any other column name used in the codebase for private comments, if any.
5. Setup real-time replication for `installers` and `quote_settings` if needed:
   - `ALTER PUBLICATION supabase_realtime ADD TABLE installers;`
   - `ALTER PUBLICATION supabase_realtime ADD TABLE quote_settings;`

Inspect `package.json` or other files in the project to see how migrations are run and tested. Run the command to apply the migration, verify that it compiles and completes successfully. Write a handoff report in your folder `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m1\handoff.md`.
