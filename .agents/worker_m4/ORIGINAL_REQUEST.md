## 2026-06-30T05:08:56Z
You are a full-stack developer worker. Your identity is worker_m4.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m4
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to implement the Client Portal updates, Dual Signature pads, Deposit calculations, and Xero invoicing integration required by Task 4 (Client Portal & Xero integration).

Detailed Instructions:

1. Create Deno Edge Function at `supabase/functions/xero-invoice/index.ts`:
   - It must handle POST requests and handle preflight CORS requests. Import CORS headers from `../_shared/cors.ts`.
   - Parse `{ quoteId }` from JSON request body.
   - Mock invoice generation and update the quote in the database: set `xero_invoice_id` to `'XERO-INV-12345'` and `xero_sync_status` to `'Synced'`.
   - Return JSON: `{ success: true, invoiceId: 'XERO-INV-12345' }`.

2. Update Client Portal page at `src/pages/QuotePortalPage.tsx`:
   - Render `data-testid="client-quote-header"` on the main page header.
   - For custom/manual items (such as `CUSTOM-POST-EXT`), render a quantity input with `data-testid="client-qty-input-CUSTOM-POST-EXT"` allowing the client to edit quantity.
   - Render optional accessory checkboxes, specifically a checkbox with `data-testid="optional-item-checkbox-SLIDING-MOTOR"` representing an optional sliding gate motor.
   - Ensure that editing quantities or checking optional items updates the totals live.
   - Renders the quote total inside `data-testid="client-quote-total"`. If the client has modified quantities or selected optional items, ensure the text contains `"Updated Total"` (e.g. `"Updated Total: $1,250.00"`).
   - Implement dual signature pads:
     - Render two canvas/drawing components with `data-testid="client-a-signature-pad"` and `data-testid="client-b-signature-pad"`.
     - Track drawing/signature state on both pads (you can use standard mouse events mousedown/mousemove/mouseup to record coordinates or set a signed boolean).
     - Render acceptance button: `data-testid="accept-quote-btn"`. It must be disabled until BOTH pads are signed.
     - When clicked, update quote status to `'accepted'` (in Supabase and localStorage) and show an alert/banner with `data-testid="quote-accepted-success-alert"`.
   - Render deposit calculations:
     - Render the calculated deposit amount and percentage (e.g. `"15%"`) inside `data-testid="deposit-amount"`. Read the percentage from global settings or default to 15%.
   - Implement deposit checkout simulation:
     - Render `data-testid="pay-deposit-btn"` button after quote is accepted.
     - When clicked, open a payment modal container with `data-testid="payment-modal"`.

3. Enhance Quote Editor page at `src/pages/CalculatorV3Page.tsx` (staff view):
   - Render `data-testid="xero-sync-status"` displaying the quote's Xero sync status (e.g. `"Unsynced"`, `"Synced"`).
   - Render `data-testid="trigger-xero-invoice-btn"` button (visible if status is accepted).
   - Render `data-testid="xero-invoice-id"` displaying the invoice ID once synced.
   - When the button is clicked:
     - Trigger edge function `xero-invoice`.
     - If it fails (or if offline), fall back to updating the local/localStorage quote to have `xero_sync_status = 'Synced'` and `xero_invoice_id = 'XERO-INV-12345'`, updating the UI state accordingly so that Cypress tests see the Synced status and invoice ID.

Ensure that type checking (`npm run typecheck`) and the production build (`npm run build`) pass cleanly. Write a handoff report in your directory `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m4\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
