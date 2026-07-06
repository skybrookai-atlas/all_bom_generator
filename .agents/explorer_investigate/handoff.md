# Handoff Report: Codebase Investigation

## 1. Observation

### Supabase Migrations & Database Schema
*   **Migrations Location:** `supabase/migrations/` (contains 29 `.sql` files, from `001_create_organisations.sql` to `032_quote_portal.sql`).
*   **`profiles` Table:** Defined in `002_create_profiles.sql` (lines 3–12) and updated with `email` in `029_add_profile_email.sql` (line 4):
    ```sql
    CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES organisations(id),
      full_name TEXT,
      company TEXT,
      phone TEXT,
      role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
      pricing_tier TEXT DEFAULT 'tier1' CHECK (pricing_tier IN ('tier1', 'tier2', 'tier3')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ```
*   **`quotes` Table:** Defined in `003_create_quotes.sql` (lines 2–15), updated with `quote_number` (sequential per org) in `007_add_quote_number.sql` (line 4), and `property_anchor` (lat/lng/address) in `030_add_quote_property_anchor.sql` (line 4):
    ```sql
    CREATE TABLE quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organisations(id),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      customer_ref TEXT,
      fence_config JSONB NOT NULL,
      gates JSONB DEFAULT '[]'::JSONB,
      bom JSONB NOT NULL,
      contact JSONB DEFAULT '{}'::JSONB,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'expired')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ```
*   **`quote_comments` Table:** Defined in `032_quote_portal.sql` (lines 5–12):
    ```sql
    CREATE TABLE IF NOT EXISTS quote_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      comment_text TEXT NOT NULL,
      is_staff BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ```
    RLS is enabled with public SELECT/INSERT policies (lines 21–25). Real-time replication is enabled for this table (line 74).
*   **`quote_acceptances` Table:** Defined in `032_quote_portal.sql` (lines 28–37) for e-signatures:
    ```sql
    CREATE TABLE IF NOT EXISTS quote_acceptances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      accepted_by TEXT NOT NULL,
      email TEXT NOT NULL,
      signature_data TEXT NOT NULL, -- Draw signature SVG or base64 representation
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ```

### Routing & Frontend Pages
*   **Routing:** Defined in `src/App.tsx` (lines 29–114) using `createBrowserRouter` from `react-router-dom`:
    *   `/quotes`: protected by `AuthGuard` -> renders `QuotesHistoryPage` (line 60).
    *   `/q/:quoteId`: public (no guard) -> renders `QuotePortalPage` (line 76).
    *   `/quote/:quoteId`: protected by `AuthGuard` -> renders `CalculatorV3Page` (line 68) to load/edit a quote.
*   **`src/pages/QuotesHistoryPage.tsx`:** Lists org quotes. Displays job names, numbers, creators, systems, layouts, dates, and prices. Status filters and the status column are currently commented out (e.g. lines 231, 366, 458, 517).
*   **`src/pages/QuotePortalPage.tsx`:** An interactive public page where clients can view a quote, select/deselect suggested optional accessories (which recalculates the totals live), and accept it by entering their email and signing (using the `SignaturePad` component). On submit, it:
    1.  Compiles the final BOM (combining standard items and selected optional accessories).
    2.  Updates `quotes.status` to `'accepted'` and saves the updated BOM (lines 191–199).
    3.  Inserts a signature record into `quote_acceptances` (lines 203–212).
    4.  Displays a live comment thread (`QuoteComments` component).

### Canvas Drawing Overlay & BOM Generation
*   **Drawing Integration:** Integrated via `src/components/calculator-v3/LayoutCanvasV3.tsx`.
    *   Renders `FenceLayoutCanvas` (line 276) and handles synchronization between the canvas engine's format and the canonical state representation (`canvasLayoutToCanonical` and `canonicalToCanvasLayout` in `canonicalAdapter.ts`).
    *   Uses a `sourceRef` ref variable to track whether changes came from the canvas or the form to prevent recursive synchronization loops (line 51, 239).
*   **BOM Generation Call:** Triggered via `useBomCalculator` React Query mutation (from `src/hooks/useBomCalculator.ts`):
    *   It expands overridden product codes per segment into separate runs using `expandSectionSystemOverrides` (line 7).
    *   If Supabase is configured and has a session, it invokes the Supabase Edge function `bom-calculator` via `supabase.functions.invoke('bom-calculator', { body: { payload, pricingTier } })` (line 62).
    *   Fallback: If unconfigured, or offline, or lacking a session, it falls back to calculating the BOM locally via `calculateLocalBom` in `src/lib/localBomCalculator.ts` (lines 55, 60, 66).
    *   In `CalculatorV3Page.tsx`, the debounced payload changes trigger `runBomRecalculation` (lines 1320, 1363), which updates the global calculator state with the resulting BOM.

### Templates, Settings, & Integrations Storage
*   **Tenant/Org Settings:** Stored in the `organisations` table: `branding` (JSONB), `settings` (JSONB) (`001_create_organisations.sql`), and `calculator_theme` (TEXT) (`027_org_calculator_theme.sql`).
*   **Rules Engine Configs (Templates/Rules):** Stored in versioned DB tables `product_variables`, `product_rules`, `product_constraints`, `product_validations`, and `product_component_selectors` (defined in migrations `011_engine_core.sql` and `012_engine_rules.sql`).
*   **Local Fallback Seeds:** Stored in JSON files in `supabase/seeds/glass-outlet/products/` (e.g. `qshs.json`, `vs.json`, etc.). These are imported raw via Vite/React in `src/lib/localSeedData.ts` (lines 1–7) to serve as local rules/component templates.
*   **PDF Templates:** Stored in `src/components/quote/BomV3PDFTemplate.tsx` (using `@react-pdf/renderer`).
*   **Credentials & Keys:** Set via environment variables in `.env` (maps integration via `VITE_GOOGLE_MAPS_API_KEY`, Supabase anon/service credentials via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

### Supabase Edge Functions & Deno Environment
*   **Location:** `supabase/functions/`
*   **Structure:**
    *   `_shared/`: Shared TypeScript modules (e.g. `auth.ts`, `canonical.types.ts`, `cors.ts`, `segmentTermination.ts`, `types.ts`).
    *   `bom-calculator/index.ts`: The main Deno Edge function. It:
        1.  Validates JWT and checks profiles for user roles (admin checks).
        2.  Fetches rules and selectors in parallel from tables (`products`, `rule_sets`, `rule_versions`, `product_rules`, `product_component_selectors`, etc.) for all unique product codes in the request (lines 247–296).
        3.  Evaluates validations, executes rules (derive -> stock -> accessory -> component stages) using `math.js`, resolves SKUs via selectors, expands companions, and queries `pricing_rules_with_sku` view to price each item (lines 40–66).
    *   `deno.json`: Deno configuration mapping global imports (lines 1–6).

## 2. Logic Chain
1.  **Database schema verification:** By examining the migration SQL scripts in order (from `002` to `032`), we confirmed how `profiles`, `quotes`, `quote_comments`, and `quote_acceptances` are structurally defined, how they reference each other via foreign keys, and what RLS policies govern them.
2.  **Routing structure:** Tracing route patterns in `src/App.tsx` mapped each URL pattern directly to its React component, demonstrating how authenticated and public portal flows are isolated.
3.  **Drawing canvas & BOM data flows:** Reading `LayoutCanvasV3.tsx` showed the visual-to-canonical adapter pattern, and examining `useBomCalculator.ts` and `CalculatorV3Page.tsx` established how visual edits trigger BOM recalculation (both via Supabase Edge Function calls and local seed-data fallback).
4.  **Local vs database configuration:** Examining `localSeedData.ts` and `localBomCalculator.ts` revealed that the application maintains a strict matching duplicate of database templates (imported JSON files from `supabase/seeds`) to ensure calculation parity even in offline/unconfigured environments.
5.  **Deno environment:** Viewing `supabase/functions/bom-calculator/index.ts` and `supabase/functions/deno.json` confirmed that edge calculations mirror the local rules logic but execute server-side using Math.js and querying database views using the service role admin client.

## 3. Caveats
*   The exact internal calculations of the `FenceLayoutCanvas` drawing component itself were not deeply analyzed, only its wrapper `LayoutCanvasV3` and the canonical serialization adapters.
*   We assumed the local seed JSON files under `supabase/seeds` are kept in sync with the database tables manually or via a deployment script. If they drift, local calculations might deviate from the server calculations.

## 4. Conclusion
*   The system uses a highly decoupling schema-driven architecture. Both visual layouts (drawn on a canvas) and manual forms compile to a shared `CanonicalPayload` structure.
*   BOM generation is product-agnostic, running an 11-step pipeline that evaluates database-defined (or seed-defined) math expressions and SKU selectors.
*   The quote portal is designed to allow unauthenticated customer interaction, enabling live price updates for optional accessory selections before securing a digital signature and locking the quote status.

## 5. Verification Method
*   **Database Schema Inspection:** Inspect `supabase/migrations/` and run migrations against a local Supabase CLI instance (`supabase migration up`) to verify database creation.
*   **Routing Check:** Start the local Vite development server (`npm run dev`) and visit `/q/<some-uuid>` to verify the public `QuotePortalPage` loads correctly.
*   **BOM Recalculation Check:** Edit a run or segment in the calculator UI, inspect the network tab, and verify either the `http://localhost:54321/functions/v1/bom-calculator` function call or local fallback returns a list of priced items matching the selected dimensions.
