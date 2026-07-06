## 2026-06-30T06:40:20Z

You are a full-stack developer worker. Your identity is worker_harden.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_harden
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to integrate the adversarial test cases into Cypress and implement the fixes for the 4 critical logic bugs identified in the adversarial audit.

Issues to Fix:

1. **Split Ratios Validation**:
   - In `src/pages/CalculatorV3Page.tsx`:
     - Clamp split Ratio A input: `val = Math.max(0, Math.min(100, Number(rawVal)))`.
     - When saving or calculating, if splits are enabled (`use_splits` is true) and either split input is empty/invalid, or they do not sum to 100, block the save and show an error toast/message.

2. **Dual Signature Pad Data Loss & Empty Signature Bypass**:
   - In `supabase/migrations/033_quotient_integration.sql`:
     - Update the migration to add a column `signature_data_b` (TEXT) to the `quote_acceptances` table:
       `ALTER TABLE quote_acceptances ADD COLUMN IF NOT EXISTS signature_data_b TEXT;`
   - In `src/pages/QuotePortalPage.tsx`:
     - Capture signature data URLs from BOTH pads (`canvasRefA` and `canvasRefB`).
     - In the accept quote logic (`onAcceptQuoteBtnClick` / `handleAcceptQuote`), capture `signatureUrlA` and `signatureUrlB`, and store/insert them into the database (`signature_data` maps to A, `signature_data_b` maps to B) and local storage quote representation.
     - Prevent empty signature click-through: only mark signature pad A as signed (`signedA`) when the client actually draws (e.g. in `onMouseMoveA` / `onTouchMoveA` when drawing, NOT immediately on mousedown/touchstart). Apply the same drawing-dependent signature logic for pad B (`signedB`).

3. **Xero Settings Bypass**:
   - In `src/pages/CalculatorV3Page.tsx`:
     - Fetch the organisation settings from `quote_settings` database table (falling back to local storage `qsbom-quote-settings` if DB fails or is empty).
     - Disable or hide the "Sync to Xero Invoice" button (`trigger-xero-invoice-btn`) if Xero is disabled in the branding settings (`xero_enabled !== true`).
   - In `supabase/functions/xero-invoice/index.ts`:
     - Add logic to verify if `xero_enabled` is true for the quote's organisation. If not, return an error response and block synchronization.

4. **Private Comments Leak**:
   - In `src/components/quote/QuoteComments.tsx`:
     - When fetching comments, if the user is not staff (e.g. `!currentUser`), filter the query so that it only selects comments where `is_private = false` (or not true). Also filter them client-side in the rendered loop as a fallback check.

Adversarial Tests Integration:
- Open `cypress/e2e/quotient_integration.cy.js`.
- Integrate the adversarial tests for:
  - Split ratios (verifying negative/empty inputs are validated and rejected).
  - Empty signatures (verifying click-through is blocked and dual signatures are captured).
  - Xero settings sync block (verifying sync button is disabled when Xero is disabled).
  - Private comments privacy (verifying private comments posted by staff are hidden from the public client portal).

Verify using `npm run typecheck`, unit tests `npm run test` and Cypress E2E `npx cypress run --spec "cypress/e2e/quotient_integration.cy.js"`. Write a handoff report at `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_harden\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
