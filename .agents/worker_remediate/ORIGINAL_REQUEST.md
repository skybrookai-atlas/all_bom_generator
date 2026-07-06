## 2026-06-30T07:01:44Z
You are a full-stack developer worker. Your identity is worker_remediate.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_remediate
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to fix the critical security and compilation bugs identified in the Forensic Audit report, and ensure all Cypress tests pass 100%.

Detailed Instructions:

1. **Multi-Tenant Security & RLS Bypass**:
   - In `supabase/migrations/033_quotient_integration.sql`:
     - Modify the policies for `installers` and `quote_settings` tables:
       Instead of `USING (true) WITH CHECK (true)` which is a major security leak, restrict them to organization-scoped policies.
       - For `installers`:
         `CREATE POLICY "Allow authenticated installers CRUD" ON installers FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());`
       - For `quote_settings`:
         `CREATE POLICY "Allow public select settings" ON quote_settings FOR SELECT USING (true);`
         `CREATE POLICY "Allow authenticated settings CRUD" ON quote_settings FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());`
   - In `supabase/migrations/032_quote_portal.sql`:
     - Restrict the `Allow public select quotes` policy:
       `CREATE POLICY "Allow public select quotes" ON quotes FOR SELECT USING (status IN ('sent', 'accepted'));`
       (This stops public users from reading draft quotes of other tenants).
     - Restrict runs and segments public read policies:
       - `Allow public select quote_runs`:
         `CREATE POLICY "Allow public select quote_runs" ON quote_runs FOR SELECT USING (EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_runs.quote_id AND quotes.status IN ('sent', 'accepted')));`
       - `Allow public select quote_run_segments`:
         `CREATE POLICY "Allow public select quote_run_segments" ON quote_run_segments FOR SELECT USING (EXISTS (SELECT 1 FROM quote_runs JOIN quotes ON quotes.id = quote_runs.quote_id WHERE quote_runs.id = quote_run_segments.quote_run_id AND quotes.status IN ('sent', 'accepted')));`
   - Scoping frontend queries:
     - In `src/pages/QuotesHistoryPage.tsx` (active installers query):
       Add `.eq("org_id", orgId)` filter, retrieving `orgId` from the `useProfile()` context. Make sure `loadActiveInstallers` dependencies include `[orgId]`.
     - In `src/pages/CalculatorV3Page.tsx` (installers list query in `loadInstallers` function):
       Filter by `.eq("org_id", userOrgId)` when `userOrgId` is resolved.

2. **TypeScript Compilation Errors**:
   - In `src/pages/CalculatorV3Page.tsx` inside `handleSaveJob` function (line 1483 / 1524 / 1546 / 1571):
     Add `if (!user) return;` at the beginning of the function or ensure `user` is null-checked so `user.id` does not compile error.
   - In `src/pages/QuotePortalPage.tsx` at lines 38-39:
     Delete the unused state declarations for `isDrawingA` and `isDrawingB` (as refs are used).

3. **Authentic Implementation & E2E Verification**:
   - In `src/hooks/useQuote.ts` (mock quote fallback inside `useQuote`):
     Update the mock quote `org_id` value from `'mock-org-id'` to a valid UUID (e.g. `'00000000-0000-0000-0000-000000000001'`).
     This ensures that `CalculatorV3Page.tsx` parses it as a valid UUID, resolves the settings config, and fetches settings from local storage, allowing the sync button to be disabled when Xero is disabled.
   - In `supabase/functions/xero-invoice/index.ts`:
     Validate the received request payload. Verify if `quoteId` is provided and is a valid UUID, query database to make sure the quote status is `'accepted'`, and query `quote_settings` to verify `xero_enabled` is true.

Verify using `npm run typecheck`, unit tests `npm run test` and Cypress E2E `npx cypress run --spec "cypress/e2e/quotient_integration.cy.js"`. Write a handoff report at `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_remediate\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
