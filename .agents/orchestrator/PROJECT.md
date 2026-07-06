# Project: Quotient Replica & Canvas BOM Generator Integration

## Architecture
- **React Frontend**: Refactored dashboard, editor, and portal pages with Tailwind styling matching Quotient.
- **Supabase DB**: Migration `033_quotient_integration.sql` creating/extending quotes, installers, quote_comments, and quote_settings.
- **Deno Edge Functions**: A new mock/stub `xero-invoice` edge function to create draft invoices in Xero upon quote acceptance.
- **Canvas Integration**: Opening the layout drawing canvas as a full-screen modal overlay in the Quote Editor.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Infra & Specs | Define E2E Cypress test specs in `cypress/e2e/quotient_integration.cy.js` for R1-R4 features | none | PLANNED |
| 2 | DB Migrations | Create Supabase migrations to extend quotes, add installers, comments privacy, settings | none | PLANNED |
| 3 | Dashboard & Settings | Implement recent quotes list, sales charts, installer availability sidebar, installers manager, account settings | M2 | PLANNED |
| 4 | Quote Editor & Modal Canvas | Upgrade Quote Editor with manual items, splits, canvas modal overlay, summary vs exploded BOM toggle, attachments | M2 | PLANNED |
| 5 | Client Portal & Xero | Upgrade portal, add signatures, checkbox/radio options, deposit simulation, create xero-invoice edge function | M3, M4 | PLANNED |
| 6 | E2E Integration Pass | Verify all test tiers pass and fix any issues | M1, M5 | PLANNED |
| 7 | Adversarial Hardening | Phase 2 coverage hardening and adversarial checks | M6 | PLANNED |

## Code Layout
- `supabase/migrations/033_quotient_integration.sql` — Database schema additions
- `src/pages/QuotesHistoryPage.tsx` — Estimator Dashboard
- `src/pages/QuotePortalPage.tsx` — Client Portal
- `src/pages/CalculatorV3Page.tsx` — Quote Editor
- `src/components/quote/CanvasCalculatorModal.tsx` — Modal overlay for drawing canvas
- `supabase/functions/xero-invoice/index.ts` — Edge function for Xero invoicing
