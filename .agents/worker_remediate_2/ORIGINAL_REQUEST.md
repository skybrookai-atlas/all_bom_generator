## 2026-06-30T21:11:57Z
You are a full-stack developer worker. Your identity is worker_remediate_2.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_remediate_2
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to fix the security and multi-tenant isolation leaks on comments, signature logs, and settings tables identified in the second Forensic Audit report.

Detailed Instructions:

1. **Database Schema & RLS Policies (Migrations)**:
   - In `supabase/migrations/033_quotient_integration.sql` (or `supabase/migrations/032_quote_portal.sql` if modifying the table definitions directly there is cleaner):
     - Alter `quote_comments` table to add `org_id` column:
       `ALTER TABLE quote_comments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;`
     - Alter `quote_acceptances` table to add `org_id` column:
       `ALTER TABLE quote_acceptances ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;`
     - Drop old insecure RLS policies for `quote_comments`, `quote_acceptances`, and `quote_settings` tables (e.g. "Allow public read comments", "Allow public insert comments", "Allow public read acceptances", "Allow public insert acceptances", "Allow public select settings", etc.).
     - Implement the new policies exactly as required by the Forensic Auditor:
       - **For `quote_settings` SELECT policy**:
         `CREATE POLICY "Allow select settings" ON quote_settings FOR SELECT USING (org_id = public.user_org_id() OR (org_id IN (SELECT org_id FROM quotes WHERE status IN ('sent', 'accepted'))));`
       - **For `quote_comments` SELECT policy**:
         `CREATE POLICY "Allow select comments" ON quote_comments FOR SELECT USING (org_id = public.user_org_id() OR (quote_id IN (SELECT id FROM quotes WHERE status IN ('sent', 'accepted'))));`
       - **For `quote_comments` INSERT policy**:
         `CREATE POLICY "Allow insert comments" ON quote_comments FOR INSERT WITH CHECK (org_id = public.user_org_id() OR (quote_id IN (SELECT id FROM quotes WHERE status = 'sent')));`
       - **For `quote_acceptances` SELECT policy**:
         `CREATE POLICY "Allow select acceptances" ON quote_acceptances FOR SELECT USING (org_id = public.user_org_id() OR (quote_id IN (SELECT id FROM quotes WHERE status IN ('sent', 'accepted'))));`
       - **For `quote_acceptances` INSERT policy**:
         `CREATE POLICY "Allow insert acceptances" ON quote_acceptances FOR INSERT WITH CHECK (org_id = public.user_org_id() OR (quote_id IN (SELECT id FROM quotes WHERE status = 'sent')));`
       - Ensure authenticated CRUD is allowed for staff on their own organisation:
         `CREATE POLICY "Allow authenticated CRUD settings" ON quote_settings FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());`
         `CREATE POLICY "Allow authenticated CRUD comments" ON quote_comments FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());`
         `CREATE POLICY "Allow authenticated CRUD acceptances" ON quote_acceptances FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());`

2. **Frontend Queries & Insertion Scoping**:
   - In `src/components/quote/QuoteComments.tsx`:
     - Update `QuoteCommentsProps` interface to accept an optional `orgId?: string`.
     - In `handleSubmit` comments insertion handler, include `org_id: orgId` in the supabase insert payload.
   - In `src/pages/CalculatorV3Page.tsx`:
     - Pass `orgId={userOrgId || quoteQuery.data?.quote?.org_id}` prop to the `<QuoteComments>` component.
     - In the page's own `loadComments` function (lines 615-625), add `.eq("org_id", userOrgId)` filter to the select query to constrain comments loading to the user's organisation.
   - In `src/pages/QuotePortalPage.tsx`:
     - Pass `orgId={quote.org_id}` to the `<QuoteComments>` component.
     - When accept quote is clicked, include `org_id: quote.org_id` in the `quote_acceptances` table insert statement.

Verify using `npm run typecheck`, unit tests `npm run test` and Cypress E2E `npx cypress run --spec "cypress/e2e/quotient_integration.cy.js"`. Write a handoff report at `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_remediate_2\handoff.md`.
