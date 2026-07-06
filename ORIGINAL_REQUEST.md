# Original User Request

## Initial Request — 2026-06-30T04:35:57+10:00

Combine the Quotient Replica quoting tool and the quickscreen-bom-generator canvas calculator into a unified web application based on the React, Vite, TS, Tailwind, and Supabase stack.

Working directory: c:\Users\Liam\Documents\QuoteBOMGenerator\all_bom_generator
Integrity mode: benchmark

## Requirements

### R1. Database Schema Extensions
* Extend the Supabase `quotes` table to include columns for:
    * `line_items` (JSONB) - ordered list of manual items (title, description, price, quantity) and calculated BOM items (with embedded canvas payload, summary toggle, and BOM details).
    * Neighbor cost splits: `is_split` (boolean), `client_b` (JSONB), `split_ratio_a` (numeric), `split_ratio_b` (numeric).
    * `deposit_percent` (numeric), `assigned_installers` (text array), and `quoted_by` (uuid references profiles).
* Create an `installers` table (id, name, active).
* Add an `is_private` boolean field to `quote_comments` table.
* Create a `quote_settings` table to store email templates, logo URL, custom colors, and integrations metadata.

### R2. Unified Estimator Dashboard & Settings
* Integrate the Quotient dashboard views into the React app:
    * Recent quotes list with status filtering (Draft, Sent, Accepted, Scheduled, Completed, Deleted, Withdrawn).
    * Sales stats charts (Pie chart for acceptance rate, Line graph for sales over time).
    * Sidebar showing installer schedule and availability.
* Add an Admin Installers manager to add/edit installers.
* Add an Account Settings page to edit branding colors, upload logos, edit email templates (with placeholders), and toggle integrations.

### R3. Quote Editor & Modal Canvas Calculator
* The main editing view is the Quote Editor:
    * Forms for client details and neighbor splits.
    * An ordered list of line items. Estimators can add manual line items, select from the Price Library templates, or click "📐 Open Canvas Calculator".
    * In the items list, calculated line items display a toggle for "Summary Mode" vs. "Exploded BOM details" and include an "📐 Edit Canvas" button.
    * Discussion thread inputting Comments (public) or Private Notes (staff only) with attachment uploads.
* Clicking "📐 Open Canvas Calculator" opens the existing drawing canvas as a full-screen overlay modal. Saving the drawing applies it back to the line item, generating the BOM and updating the price, and storing the canvas payload in the line item JSON.

### R4. Upgraded Client Portal & Xero Integration
* Upgrade `QuotePortalPage.tsx` to Quotient's portal styling:
    * Allow client-editable quantities (recalculating totals live), checkbox options, and multiple choice radio options.
    * Render dual e-signature blocks for neighbor cost splits (Client A and Client B).
    * Interactive comment thread supporting attachments.
    * Pay deposit button that simulates payment and updates the DB state.
* Create a Supabase Edge Function (`xero-invoice`) that compiles the line items (summarized or detailed depending on settings) and client details, and creates a Draft Invoice in Xero when a quote is accepted.

---

## Acceptance Criteria

### Technical Compilation
- [ ] React application builds cleanly (`npm run build` exits 0) without TypeScript or bundler errors.
- [ ] All database changes are structured as valid Supabase migrations in `supabase/migrations/`.

### Functional Quoting & Calculator
- [ ] Quotes can be created in the editor with neighbor splits (e.g. 50/50) and assigned installers.
- [ ] Opening the canvas calculator modal from a line item allows drawing runs/gates and compiles the correct BOM based on local rules.
- [ ] Calculated items can be saved back to the editor, toggled between summary and exploded component display, and re-edited via "Edit Canvas".
- [ ] The public Client Portal allows Client A and Client B to sign separately, tracks their signatures, ip addresses, and dates, and updates the quote status to `accepted`.
- [ ] The portal allows clients to toggle optional items, change editable quantities, and simulates deposit payment.
- [ ] A mock/stub for the Xero Edge Function receives the correct payload to create a draft invoice upon quote acceptance.

### Dashboard & Analytics
- [ ] Dashboard displays recent quotes with status filters, search, sales metrics, and installer schedule.
- [ ] Stats page shows correct charts (Pie and Line graph) using Recharts or custom SVG for acceptance rates and volume over time.
