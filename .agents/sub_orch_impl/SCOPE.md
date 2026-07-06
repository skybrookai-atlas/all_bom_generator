# Scope: Quotient Integration Implementation

## Architecture
- **Supabase DB**: Migration `033_quotient_integration.sql` defining `installers` and `quote_settings` tables, adding fields to `quotes` (`assigned_installer_id`, `install_date`, `use_splits`, `split_ratio_a`, `split_ratio_b`, `xero_invoice_id`, `xero_sync_status`), and `quote_comments` (`is_private`).
- **React Frontend Routing**: Define routes `/admin/settings` and `/admin/installers` in `src/App.tsx`.
- **Dashboard (`QuotesHistoryPage.tsx`)**: Recent quotes list, status filters, analytics charts/metrics, installer availability sidebar.
- **Installers Manager (`InstallersAdminPage.tsx`)**: CRUD page for installers database table.
- **Settings Page (`SettingsAdminPage.tsx`)**: Form for updating logo, theme colors, deposit percentage, and Xero sync toggle.
- **Quote Editor (`CalculatorV3Page.tsx`)**: Form fields for installer assignment, installation date, client split checkbox & inputs, manual/custom items adder, template selector, layout canvas modal overlay triggers, and BOM summary vs exploded view formatter.
- **Client Portal (`QuotePortalPage.tsx`)**: Direct access via `/q/:quoteId`, client quantity adjustments, optional accessories checkboxes, dual signature pads, deposit calculation & payment simulation modal.
- **Deno Edge Function (`supabase/functions/xero-invoice/index.ts`)**: Mock invoice generator returning draft invoices.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | DB Migrations | Create and execute `supabase/migrations/033_quotient_integration.sql` | none | PLANNED |
| 2 | Dashboard & Settings | Implement recent quotes, filters, analytics, sidebars, settings page, installers admin page, and route registrations | M1 | PLANNED |
| 3 | Quote Editor & Modal Canvas | Implement splits, custom items, template loader, canvas modal, and summary vs exploded toggles | M1 | PLANNED |
| 4 | Client Portal & Xero | Update portal layout, quantity updates, checkboxes, dual signatures, deposit modal, edge function, and invoice trigger button | M2, M3 | PLANNED |
| 5 | E2E Integration Pass | Verify 100% of Cypress E2E test cases pass | M4 | PLANNED |
| 6 | Adversarial Hardening | Phase 2 coverage hardening, compilation audit, and code layout check | M5 | PLANNED |

## Interface Contracts
### Supabase Client ↔ Database
- Installers schema: `id UUID`, `org_id UUID`, `name TEXT`, `email TEXT`, `phone TEXT`, `status TEXT`.
- Settings schema: `org_id UUID PRIMARY KEY`, `logo_url TEXT`, `primary_color TEXT`, `secondary_color TEXT`, `default_deposit NUMERIC`, `xero_enabled BOOLEAN`.
- Quotes additions: `assigned_installer_id UUID REFERENCES installers`, `install_date DATE`, `use_splits BOOLEAN DEFAULT false`, `split_ratio_a INT DEFAULT 50`, `split_ratio_b INT DEFAULT 50`, `xero_invoice_id TEXT`, `xero_sync_status TEXT DEFAULT 'Unsynced'`.
- Quote comments additions: `is_private BOOLEAN DEFAULT false`.

### Client Portal ↔ Deno Edge Function `xero-invoice`
- Request: `{ quoteId: string }`
- Response: `{ success: true, invoiceId: string }`
