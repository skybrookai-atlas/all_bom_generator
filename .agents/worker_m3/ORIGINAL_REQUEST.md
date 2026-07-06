## 2026-06-30T05:01:27Z
You are a frontend developer worker. Your identity is worker_m3.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m3
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to implement the enhancements to the Quote Editor and Drawing Canvas modal integration required by Task 3 (Quote Editor & Modal Canvas Calculator), and ensure they are integrated with the database hooks (including local/localStorage fallback).

Detailed Instructions:

1. Update `src/hooks/useQuote.ts` to add local storage support:
   - If the Supabase query fails or is offline, check `localStorage` key `qsbom-quotes` for a quote with `id === quoteId`.
   - If found, construct the canonical payload (using `resolveCanonicalPayload`) and return it.
   - If not found (e.g. for `mock-quote-id` or `mock-client-quote-id`), return a default mock quote object so the editor loads successfully instead of crashing.
     - Mock quote object fields:
       - `id`: `quoteId`
       - `org_id`: `mock-org-id`
       - `user_id`: `mock-user-id`
       - `customer_ref`: `Mock Customer`
       - `fence_config`: a valid basic fence config (e.g. `{ system_type: 'QSHS', run_length: 7500 }` or similar)
       - `bom`: `{}` (empty BOM or mock BOM)
       - `status`: `'draft'` (or accepted if `mock-client-quote-id`)
       - `assigned_installer_id`: null
       - `install_date`: null
       - `use_splits`: false
       - `split_ratio_a`: 50
       - `split_ratio_b`: 50
       - `xero_invoice_id`: null
       - `xero_sync_status`: 'Unsynced'

2. Upgrade `src/pages/CalculatorV3Page.tsx` (Quote Editor page):
   - Add assigned installer and install date inputs:
     - `data-testid="quote-assigned-installer"` (select element listing installers from DB/localStorage, with an option like "Installer John Doe").
     - `data-testid="quote-install-date"` (date picker input).
   - Add quote split ratio configuration UI:
     - `data-testid="quote-split-checkbox"` (checkbox input).
     - `data-testid="quote-split-ratio-a"` (number input).
     - `data-testid="quote-split-ratio-b"` (number input).
     - `data-testid="save-quote-btn"` (button to save settings and quote).
     - Auto-calculate: when Ratio A changes, Ratio B must update to `100 - Ratio A` so they always sum to 100.
     - On save, update the quote status/fields in DB & localStorage.
   - Add custom/manual items adder:
     - `data-testid="add-manual-item-btn"` (button).
     - Inputs:
       - `data-testid="manual-item-sku"`
       - `data-testid="manual-item-name"`
       - `data-testid="manual-item-qty"`
       - `data-testid="manual-item-price"`
       - `data-testid="save-manual-item-btn"` (button).
     - When saved, add the custom manual item to the quote's BOM.
     - The BOM table container must have `data-testid="bom-table"`.
     - Each manual item row in the BOM list must render cells with:
       - `data-testid="bom-row-code"` (displaying SKU, e.g. CUSTOM-POST-EXT)
       - `data-testid="bom-row-qty"`
       - `data-testid="bom-row-unit-price"`
       - `data-testid="bom-row-line-total"` (calculated total qty * price).
   - Add templates selection list:
     - `data-testid="quote-templates-list"` (select element).
     - Include option "Standard 3-Panel Gate".
     - Inputs to update:
       - `data-testid="system-type"` (needs value `"QSHS"` when Standard 3-Panel Gate is selected)
       - `data-testid="run-length"` (needs value `"7500"` when Standard 3-Panel Gate is selected)
     - Ensure changing template updates the global payload variables.
   - Add canvas modal overlay trigger and modal:
     - `data-testid="open-canvas-modal-btn"` (button).
     - Modal wrapper: `data-testid="canvas-overlay-modal"`.
     - Inside modal:
       - `data-testid="canvas-drawing-area"`
       - `data-testid="canvas-zoom-in-btn"` (button)
       - `data-testid="canvas-toggle-satellite-btn"` (button)
       - `data-testid="save-canvas-modal-btn"` (button)
     - When saving inside modal, close modal and trigger BOM recalculation (or refresh).
   - Add BOM formatting view toggle:
     - `data-testid="bom-view-toggle"` (container/wrapper).
     - `data-testid="bom-format-summary"` (button).
     - `data-testid="bom-format-exploded"` (button).
     - Toggle class: when summary format is selected, add `bom-summary-format` class to the BOM table `[data-testid="bom-table"]`. When exploded format is selected, add `bom-exploded-format` class.

Ensure that type checking (`npm run typecheck`) and the production build (`npm run build`) pass cleanly. Write a handoff report in your directory `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m3\handoff.md`.
