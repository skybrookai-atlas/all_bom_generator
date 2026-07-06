## 2026-06-30T04:56:17Z
You are a frontend developer worker. Your identity is worker_m2.
Your working directory is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m2
The workspace root is: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator

Your task is to implement the pages and dashboard modifications required by Task 2 (Dashboard & Settings) and integrate them with the router and database, including offline/Cypress localStorage fallback.

Detailed Instructions:

1. Register new routes in `src/App.tsx`:
   - `/admin/settings` rendering `<SettingsAdminPage />` protected by `AuthGuard` or `AdminGuard` (matching other admin routes but testable).
   - `/admin/installers` rendering `<InstallersAdminPage />` protected by `AuthGuard` or `AdminGuard`.
   - Import these new pages correctly.

2. Create Settings Admin page at `src/pages/admin/SettingsAdminPage.tsx`:
   - It must implement a branding settings form.
   - Required elements with test ids:
     - `data-testid="setting-logo-url"` (input)
     - `data-testid="setting-primary-color"` (input)
     - `data-testid="setting-secondary-color"` (input)
     - `data-testid="setting-default-deposit"` (input)
     - `data-testid="setting-xero-enabled"` (checkbox input)
     - `data-testid="settings-save-btn"` (button)
   - On load, it must retrieve settings (from `quote_settings` database table for user org_id; fallback/load from `localStorage` key `qsbom-quote-settings` if DB query fails or returns empty).
   - On submit, it must upsert to the database and also write to `localStorage` (to guarantee persistence for Cypress testing across reloads, even when the Supabase container is offline).

3. Create Installers Admin page at `src/pages/admin/InstallersAdminPage.tsx`:
   - It must implement a CRUD interface for installers.
   - Required input fields with test ids:
     - `data-testid="installer-name"` (input)
     - `data-testid="installer-email"` (input)
     - `data-testid="installer-phone"` (input)
     - `data-testid="installer-status"` (select dropdown, options Active/Inactive)
     - `data-testid="installer-save-btn"` (button)
   - Display list of installers.
   - Each installer row in the list must have:
     - `data-testid="installer-list-row"`
     - `data-testid="edit-installer-btn"`
     - `data-testid="delete-installer-btn"`
   - Implement save, edit, delete logic. Like settings, it must read/write to the database `installers` table, but also sync to `localStorage` (key `qsbom-installers`) as a fallback to ensure the list functions and persists during testing without database connection.

4. Modify `src/pages/QuotesHistoryPage.tsx`:
   - Wrap the main quote list table/container with `data-testid="recent-quotes-list"`.
   - Each quote item row must have `data-testid="quote-row"`.
   - Inside the row, render a status badge with `data-testid="quote-status-badge"`. It must display the capitalized status (e.g., Draft, Sent, Accepted, Declined).
   - Uncomment and implement the status filter UI with `data-testid="quote-status-filter"`.
   - Make sure there is an element (e.g. button or status badge selector) with `data-testid="status-filter-accepted"` that sets the filter status to accepted.
   - Render dashboard metrics:
     - `data-testid="quotes-analytics-chart"` (a styled graph container or card).
     - `data-testid="total-quotes-metric"` (displays count of total quotes).
     - `data-testid="acceptance-rate-metric"` (displays calculated or mockup acceptance rate, e.g., "75%").
   - Render installer availability sidebar on this page:
     - `data-testid="installer-availability-sidebar"` (container).
     - `data-testid="installer-availability-row"` (display active installers from DB/localStorage).
     - `data-testid="manage-installers-btn"` (button/link navigating to `/admin/installers`).

5. Robust local/localStorage fallbacks in hooks:
   - Update `src/hooks/useQuotes.ts` so that if the Supabase fetch fails or is offline, it falls back to loading quotes from `localStorage` (key `qsbom-quotes`), and when saving/updating quotes, it writes to `localStorage` as well.
   - Add initial seed quotes to `localStorage` on load if it is empty, to make sure there are rows for the Cypress tests to find (the Cypress test expects `cy.get('[data-testid="quote-row"]').should("have.length.greaterThan", 0)` on load).

Ensure that type checking (`npm run typecheck`) and the build (`npm run build`) pass cleanly. Write a handoff report in your directory `c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator\.agents\worker_m2\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
