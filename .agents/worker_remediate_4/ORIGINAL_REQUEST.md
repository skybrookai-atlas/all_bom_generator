## 2026-06-30T07:33:02Z
You are a full-stack developer worker. Your identity is worker_remediate_4.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_remediate_4
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to harden database-level security in the migrations file `supabase/migrations/033_quotient_integration.sql` exactly as specified by the Forensic Auditor.

Detailed Instructions:

1. **Database RLS Policies Hardening**:
   - Open `supabase/migrations/033_quotient_integration.sql`.
   - At the bottom of the file (or replacing the previous creation lines), drop and recreate the following RLS policies:
     - **Private Comments Bypass SELECT check**:
       - Drop old: `DROP POLICY IF EXISTS "Allow select comments" ON quote_comments;`
       - Re-create:
         `CREATE POLICY "Allow select comments" ON quote_comments FOR SELECT USING (org_id = public.user_org_id() OR (is_private = false AND quote_id IN (SELECT id FROM quotes WHERE status IN ('sent', 'accepted'))));`
     - **Cross-Tenant or NULL Insertion for comments**:
       - Drop old: `DROP POLICY IF EXISTS "Allow insert comments" ON quote_comments;`
       - Re-create:
         `CREATE POLICY "Allow insert comments" ON quote_comments FOR INSERT WITH CHECK ((org_id = public.user_org_id() OR (org_id = (SELECT org_id FROM quotes WHERE id = quote_id) AND quote_id IN (SELECT id FROM quotes WHERE status = 'sent'))));`
     - **Cross-Tenant or NULL Insertion for acceptances**:
       - Drop old: `DROP POLICY IF EXISTS "Allow insert acceptances" ON quote_acceptances;`
       - Re-create:
         `CREATE POLICY "Allow insert acceptances" ON quote_acceptances FOR INSERT WITH CHECK ((org_id = public.user_org_id() OR (org_id = (SELECT org_id FROM quotes WHERE id = quote_id) AND quote_id IN (SELECT id FROM quotes WHERE status = 'sent'))));`
     - **Insecure Quotes Update Policy**:
       - Drop old: `DROP POLICY IF EXISTS "Allow public update quote to accept" ON quotes;`
       - Re-create:
         `CREATE POLICY "Allow public update quote to accept" ON quotes FOR UPDATE TO anon, authenticated USING (status = 'sent') WITH CHECK (status = 'accepted');`

Verify using `npm run typecheck`, unit tests `npm run test` and Cypress E2E `npx cypress run --spec "cypress/e2e/quotient_integration.cy.js"`. Write a handoff report at `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_remediate_4\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
