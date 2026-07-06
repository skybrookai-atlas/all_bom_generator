# Handoff Report: Quotient Integration Adversarial Code & Coverage Audit

## 1. Observation

### Observation 1.1: Invalid Split Ratios UI Calculation and Save Behavior
- **File path**: `src/pages/CalculatorV3Page.tsx`
- **Line 463-473**:
  ```tsx
  const handleRatioAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === "") {
      setSplitRatioA("");
      setSplitRatioB("");
      return;
    }
    const val = Number(rawVal);
    setSplitRatioA(val);
    setSplitRatioB(100 - val);
  };
  ```
- **Line 1404-1406** (inside `handleSaveJob` local fallback):
  ```tsx
        split_ratio_a: Number(splitRatioA),
        split_ratio_b: Number(splitRatioB),
  ```
- **Line 1448-1449** (inside `handleSaveJob` DB update):
  ```tsx
            split_ratio_a: Number(splitRatioA),
            split_ratio_b: Number(splitRatioB),
  ```
- **File path**: `supabase/migrations/033_quotient_integration.sql`
- **Line 54-55**:
  ```sql
    ADD COLUMN IF NOT EXISTS split_ratio_a NUMERIC DEFAULT 50,
    ADD COLUMN IF NOT EXISTS split_ratio_b NUMERIC DEFAULT 50,
  ```

### Observation 1.2: Discarded Client B Signature (Signature Loss)
- **File path**: `src/pages/QuotePortalPage.tsx`
- **Line 517-520**:
  ```tsx
  const onAcceptQuoteBtnClick = async () => {
    const signatureUrl = canvasRefA.current?.toDataURL("image/png") || "mock-signature-url";
    await handleAcceptQuote(signatureUrl, quote?.contact?.fullName || "Client Dual Signature");
  };
  ```
- **File path**: `supabase/migrations/032_quote_portal.sql`
- **Line 28-37**:
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

### Observation 1.3: Settings Xero Integration Bypass
- **File path**: `src/pages/CalculatorV3Page.tsx`
- **Line 2441-2451**:
  ```tsx
  {quoteQuery.data?.quote?.status === "accepted" && (
    <button
      type="button"
      data-testid="trigger-xero-invoice-btn"
      disabled={syncingXero}
      onClick={handleXeroSync}
      className="w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-bold text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
    >
      {syncingXero ? "Syncing..." : "Sync to Xero Invoice"}
    </button>
  )}
  ```
- **File path**: `supabase/functions/xero-invoice/index.ts`
- **Line 28-35**:
  ```typescript
    const { error } = await supabase
      .from("quotes")
      .update({
        xero_invoice_id: "XERO-INV-12345",
        xero_sync_status: "Synced",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId);
  ```

### Observation 1.4: Private Comments Privacy Leak
- **File path**: `src/components/quote/QuoteComments.tsx`
- **Line 35-39**:
  ```typescript
        const { data, error } = await supabase
          .from("quote_comments")
          .select("*")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: true });
  ```
- **Line 166-197**:
  ```typescript
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`flex flex-col space-y-1 max-w-[85%] ${
                comment.is_staff === isStaff ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              ...
              {/* Message Bubble */}
              <div ...>
                {comment.comment_text}
              </div>
            </div>
          ))
  ```
- **File path**: `supabase/migrations/032_quote_portal.sql`
- **Line 21-22**:
  ```sql
  CREATE POLICY "Allow public read comments" ON quote_comments
    FOR SELECT USING (true);
  ```

---

## 2. Logic Chain

### 2.1. Logic Chain for Split Ratios Vulnerability
1. **Input State Handling**: In `src/pages/CalculatorV3Page.tsx`, entering an empty string into the Ratio A field sets both `splitRatioA` and `splitRatioB` state variables to `""`.
2. **Numeric Coercion**: When saving the job, the application calls `Number("")`, which returns `0`. The split ratios are persisted as `0` and `0` respectively.
3. **Incorrect Sum**: Saving `0` and `0` means the split ratios do not sum to 100%.
4. **Invalid Inputs**: Entering a negative number like `-10` makes Ratio B `100 - (-10) = 110`. These values are saved without any validator checks in the UI.
5. **Database Deficiencies**: The `quotes` table definition in `033_quotient_integration.sql` does not contain check constraints to validate that the ratios are positive or sum to 100.
6. **Conclusion**: Invalid, negative, or zero ratios can be successfully saved to the database.

### 2.2. Logic Chain for Signature Discard Vulnerability
1. **Interactive UI**: The client portal `QuotePortalPage.tsx` displays two signature canvases (`canvasRefA` and `canvasRefB`). The accept button requires both to have `signedA` and `signedB` set to `true`.
2. **Accept Trigger**: Clicking the accept button fires `onAcceptQuoteBtnClick`.
3. **Data Extraction**: The code extracts `canvasRefA.current?.toDataURL(...)` but never references `canvasRefB.current`.
4. **Database Table**: The `quote_acceptances` table only contains a single column `signature_data` for storing one signature.
5. **Data Loss**: Client B's signature is discarded, meaning the second signature is never persisted or verified.
6. **Conclusion**: Dual signature pads are a facade; one signature is permanently lost on submission.

### 2.3. Logic Chain for Xero Settings Bypass
1. **Settings configuration**: In `SettingsAdminPage.tsx`, administrators can check or uncheck `Enable Xero Integration`, updating `xero_enabled` in `quote_settings` table.
2. **UI Rendering**: In `CalculatorV3Page.tsx`, the sync button is rendered for any accepted quote. It does not read `quote_settings` or conditionally hide/disable itself based on `xero_enabled`.
3. **Function Invocation**: Clicking the sync button invokes the `xero-invoice` Edge function.
4. **Database Bypass**: The edge function performs the sync update without looking up the organisation's `xero_enabled` setting in `quote_settings`.
5. **Conclusion**: Users can sync quotes to Xero even if Xero is explicitly disabled in admin settings.

### 2.4. Logic Chain for Private Comments Privacy Leak
1. **Staff Flags**: Comments have an `is_private` column indicating internal-only vendor discussions.
2. **Database Policies**: The `Allow public read comments` policy allows public/anonymous clients to query all comment records.
3. **Public Fetching**: In `QuoteComments.tsx`, the fetch logic selects `*` from `quote_comments` matching the `quote_id`, without filtering out `is_private = true`.
4. **Rendering Leak**: The frontend loops over all fetched comments and renders them regardless of whether they are marked as private.
5. **Conclusion**: Internal staff-only comments are visible in the public client portal.

---

## 3. Caveats

- **Xero Connection Mocking**: We observed that the `xero-invoice` function currently mocks the Xero API call internally by immediately updating the status to "Synced" and returns `XERO-INV-12345`. Actual API integration with Xero's oauth tokens is not yet in scope for the edge function.
- **Local Storage Mock Session**: The tests rely on local storage authentication mocking to simulate an authenticated admin user. 
- **No constraints on DB level**: Since the database schema is defined as is, we did not modify it, adhering to the "Review-only" key constraint.

---

## 4. Conclusion & Adversarial Report

### Challenge Summary

- **Overall risk assessment**: CRITICAL (due to legal/contractual vulnerability in signature loss, and security/privacy breach in private comment leaks).

---

### Challenges

### [High] Challenge 1: Invalid Split Ratios Bypass
- **Assumption challenged**: That the UI and database secure the integrity of split invoice ratios (positive, non-empty, and summing to 100%).
- **Attack scenario**: A user inputs a blank value or negative value in Ratio A. The UI calculates incorrect corresponding numbers, and the database accepts these values without constraints.
- **Blast radius**: High. Downstream systems (e.g. billing, invoicing, payments) will encounter arithmetic errors, negative amounts, or division by zero.
- **Mitigation**: Add UI state validators before save and apply a check constraint in the database migration: `split_ratio_a >= 0 AND split_ratio_b >= 0 AND (split_ratio_a + split_ratio_b) = 100`.

### [Critical] Challenge 2: Dual Signature Pad - Second Signature Loss
- **Assumption challenged**: That the dual signature pads capture and store signatures for both clients.
- **Attack scenario**: Both clients sign the proposal on the client portal. Upon submitting, only Client A's signature is sent and stored in the database. Client B's signature is discarded.
- **Blast radius**: Critical. Undermines the legal validity of the signed agreement.
- **Mitigation**: Add a second column `signature_data_b` in the database, capture both canvases, and save both.

### [Medium] Challenge 3: Settings Xero Integration Bypass
- **Assumption challenged**: That disabling Xero in settings prevents invoice synchronization.
- **Attack scenario**: Xero integration is disabled in settings. A staff member visits an accepted quote and clicks the "Sync to Xero Invoice" button, which successfully invokes the edge function and marks it as synced.
- **Blast radius**: Medium. Policy bypass.
- **Mitigation**: Fetch the settings row in `CalculatorV3Page.tsx` and check `xero_enabled` before displaying the button. Add verification in the Edge function code.

### [High] Challenge 4: Private Comments Privacy Leak
- **Assumption challenged**: That internal staff-only/private comments are hidden from public clients.
- **Attack scenario**: Staff posts a private comment. A guest client visits the portal page; their browser fetches all comments and renders the private comment directly.
- **Blast radius**: High. Leaks proprietary staff deliberations to the customer.
- **Mitigation**: Alter the read policy on `quote_comments` to filter private comments for guest users, and filter them out in the frontend `QuoteComments.tsx` query.

---

## Stress Test Results

- **Set Split Ratio A to blank** → Both ratios display blank → Saved as `0` and `0` (fails to sum to 100) → **FAIL**
- **Set Split Ratio A to -10** → Ratios calculated as `-10` and `110` → Saved to database successfully → **FAIL**
- **Sign both Client A and Client B pads** → Form validates and submits → Only Client A's signature saved in database → **FAIL**
- **Trigger Xero Sync when Xero is disabled** → Triggers sync process → Quote status marked as Synced → **FAIL**
- **Post private comment and view client portal** → Portal fetches and renders comment → Comment visible to guest client → **FAIL**

---

## 5. Verification Method

To verify these findings and reproduce the edge cases:

1. **Verify Split Ratios Bypass**:
   - Inspect `src/pages/CalculatorV3Page.tsx` at line 463 to see the state setting.
   - Run Vite server: `npm run dev`.
   - Edit split ratio: check splits box, enter negative number or clear the input. Click save.
   - Query the database quotes table for that quote to confirm that the invalid split ratios were saved.

2. **Verify Signature Loss**:
   - Inspect `src/pages/QuotePortalPage.tsx` at line 517.
   - Note that `canvasRefB` is never read.

3. **Verify Xero Settings Bypass**:
   - Check `src/pages/CalculatorV3Page.tsx` at line 2441. Note that the button is rendered without checking settings.
   - Inspect `supabase/functions/xero-invoice/index.ts` to see that it doesn't query the settings table before performing updates.

4. **Verify Private Comments Leak**:
   - Check `src/components/quote/QuoteComments.tsx` line 35. Note that the select query lacks filtering on `is_private`.
