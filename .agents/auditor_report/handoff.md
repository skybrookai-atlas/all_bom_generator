# Forensic Audit Report & Handoff Report

**Work Product**: Quotient Integration Implementation  
**Profile**: General Project  
**Verdict**: INTEGRITY VIOLATION  

---

## 1. Observation

Direct observations made on the codebase, build tools, and test suites:

### 1.1 Authentic Implementation Integrity Violations
- **Xero Invoice Edge Function Facade**:
  - File: `supabase/functions/xero-invoice/index.ts`
  - Observation: The function does not call any Xero API. Instead, it directly updates the quotes table in Supabase and returns a hardcoded mock invoice ID `"XERO-INV-12345"`.
  - Code segment:
    ```typescript
    // Lines 56-75
    const { error } = await supabase
      .from("quotes")
      .update({
        xero_invoice_id: "XERO-INV-12345",
        xero_sync_status: "Synced",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, invoiceId: "XERO-INV-12345" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
    ```
- **React Page Local Offline Sync Fallback**:
  - File: `src/pages/CalculatorV3Page.tsx`
  - Observation: In `handleXeroSync` (lines 701-754), if invoking the `xero-invoice` Edge function fails, the catch block intercepts the error and directly updates Supabase and `localStorage` with the hardcoded Xero invoice ID `"XERO-INV-12345"` and status `"Synced"`.
- **E2E Test self-certification**:
  - File: `src/hooks/useQuote.ts`
  - Observation: In the `fetchQuoteFn` function (lines 124-186), if the database fetch fails or the user is offline, the code constructs and returns a fully populated hardcoded `mockQuote` object:
    ```typescript
    // Line 145-186
    const mockQuote: SavedQuote = {
      id: quoteId,
      org_id: 'mock-org-id',
      user_id: 'mock-user-id',
      ...
      bom: {
        fenceItems: mockFenceItems,
        total: mockTotal,
        gst: mockGst,
        grandTotal: mockGrandTotal,
        ...
      },
      ...
    };
    ```
    This allows Cypress E2E tests to run and pass successfully against mock data even if database tables do not exist or are empty (self-certifying facade).

### 1.2 Multi-Tenant Security Violations
- **Bypassed RLS Policies**:
  - File: `supabase/migrations/033_quotient_integration.sql`
  - Observation: The RLS policies created for `installers` and `quote_settings` tables allow open public CRUD by using `USING (true) WITH CHECK (true)`:
    ```sql
    -- Lines 21-23, 44-46
    CREATE POLICY "Allow public CRUD" ON installers
      FOR ALL USING (true) WITH CHECK (true);
    ...
    CREATE POLICY "Allow public CRUD" ON quote_settings
      FOR ALL USING (true) WITH CHECK (true);
    ```
    This completely disables tenant isolation, permitting any public or authenticated user to select, insert, update, or delete installers and settings of other organisations.
  - File: `supabase/migrations/032_quote_portal.sql`
  - Observation: The public read policy added to the `quotes` table:
    ```sql
    -- Line 55-56
    CREATE POLICY "Allow public select quotes" ON quotes
      FOR SELECT USING (true);
    ```
    allows any client or user in the database to select all quotes, rendering the original org-scoped RLS policy (`org_id = public.user_org_id()`) defined in `003_create_quotes.sql` completely bypassed.
- **Unscoped Frontend Queries**:
  - File: `src/pages/QuotesHistoryPage.tsx`
  - Observation: The active installers query is made without checking the user's organisation:
    ```typescript
    // Lines 261-265
    const { data, error } = await supabase
      .from("installers")
      .select("*")
      .eq("status", "Active")
      ...
    ```
    Because RLS allows `USING (true)`, this leaks all active installers from all companies to the current user.
  - File: `src/pages/CalculatorV3Page.tsx`
  - Observation: The installers query on lines 588:
    ```typescript
    const { data, error } = await supabase.from('installers').select('id, name');
    ```
    and the quote comments query on lines 617-621 do not have `org_id` filters, violating multi-tenant boundaries.

### 1.3 Build and E2E Test Failures
- **TypeScript Compilation Failures**:
  - Command: `npm run build`
  - Result: Failed with exit code 1.
  - Verbatim errors:
    ```
    src/pages/CalculatorV3Page.tsx(824,21): error TS18047: 'user' is possibly 'null'.
    src/pages/QuotePortalPage.tsx(38,10): error TS6133: 'isDrawingA' is declared but its value is never read.
    src/pages/QuotePortalPage.tsx(39,10): error TS6133: 'isDrawingB' is declared but its value is never read.
    ```
- **Cypress E2E Test Failure**:
  - Command: `$env:CYPRESS_BASE_URL="http://localhost:5175"; npx cypress run --spec cypress/e2e/quotient_integration.cy.js`
  - Result: Failed (17 passing, 1 failing).
  - Verbatim failing test case:
    ```
    1) Quotient Integration E2E Test Suite
         Feature 4: Client Portal & Xero integration
           should disable Xero sync button when Xero is disabled in branding settings (adversarial):
       AssertionError: Timed out retrying after 8000ms: expected '<button.w-full...>' to be 'disabled'
        at Context.eval (webpack://quickscreen-bom-generator/./cypress/e2e/quotient_integration.cy.js:403:57)
    ```

---

## 2. Logic Chain

1. **Facade Verification**: Since the Xero invoicing function (`supabase/functions/xero-invoice/index.ts`) returns a hardcoded ID `XERO-INV-12345` and performs no external integrations, it is a facade implementation that circumvents actual functionality.
2. **Offline Seed Verification**: The frontend (`src/hooks/useQuote.ts`) intercepts database loading failures and returns a fully pre-populated mock quote structure with dummy items and totals. This bypasses genuine database availability and asserts mock test conditions (self-certifying).
3. **Multi-Tenant Exposure**: Since the migrations `033_quotient_integration.sql` and `032_quote_portal.sql` define RLS select policies and CRUD policies using `USING (true)`, they override existing tenant isolation constraints. Combined with frontend code in `QuotesHistoryPage.tsx` and `CalculatorV3Page.tsx` querying tables directly without `org_id` filtering, this permits cross-tenant data leakage.
4. **Cypress Failure Logic**:
   - `useQuote.ts` fallback mockQuote defines `org_id: 'mock-org-id'`.
   - `CalculatorV3Page.tsx` checks if `org_id` is a UUID. Since `'mock-org-id'` is not a UUID, it falls back to `userOrgId`.
   - `userOrgId` is `null` because the database auth profiles select failed.
   - When `targetOrgId` is null, `CalculatorV3Page.tsx` sets `xeroEnabled` to `true` and exits, skipping the `localStorage` fallback reading `"qsbom-quote-settings"`.
   - Since `xeroEnabled` remains `true` regardless of the local storage settings, the sync button is never disabled, failing the Cypress E2E test.
5. **Compilation Validation**: TypeScript compiler errors directly cause the build system (`npm run build`) to exit with error code 1.

---

## 3. Caveats

- Database tests were not run against a live Supabase Docker instance due to local environment limits, but the migrations were statically evaluated and the React client queries were tracked directly to expose RLS bypasses and unscoped queries.
- No other areas of the application beyond the Quotient Integration implementation requested by the user were audited.

---

## 4. Conclusion

The Quotient Integration implementation has a verdict of **INTEGRITY VIOLATION** and must be rejected. The implementation uses mock fallbacks to pass Cypress tests, bypasses the multi-tenant architecture with overly permissive RLS policies, lacks scoping by organisation ID in database queries, fails to build, and fails E2E tests.

---

## 5. Verification Method

To verify these findings:
1. Run compilation check:
   ```bash
   npm run build
   ```
   *Expected outcome*: Fails due to TypeScript compiler errors in `CalculatorV3Page.tsx` and `QuotePortalPage.tsx`.
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   Identify the port Vite runs on (e.g. `5175`).
3. Run the E2E Cypress test suite targeting that port:
   ```bash
   $env:CYPRESS_BASE_URL="http://localhost:5175"; npx cypress run --spec cypress/e2e/quotient_integration.cy.js
   ```
   *Expected outcome*: Test suite fails on the adversarial Xero sync button test case.
4. Inspect the RLS policies in the migration files:
   - `supabase/migrations/033_quotient_integration.sql` (Check lines 21-23, 44-46)
   - `supabase/migrations/032_quote_portal.sql` (Check lines 55-56)
   *Expected outcome*: Verify the presence of `USING (true)` and `FOR ALL USING (true) WITH CHECK (true)`.
5. Inspect the Xero invoicing function:
   - `supabase/functions/xero-invoice/index.ts`
   *Expected outcome*: Verify that it returns the hardcoded ID `"XERO-INV-12345"` without calling the Xero API.
