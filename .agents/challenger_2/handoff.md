# Handoff Report — Quotient Integration Adversarial & Coverage Audit

## 1. Observation
Manual code auditing and database schema inspection of the Quotient Integration implementation revealed the following verbatim lines, components, and policy rules:

### A. Split Ratios Validation Gaps (`src/pages/CalculatorV3Page.tsx`)
- **Ratio A Change Handler** (Lines 463-473):
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
- **Job Save Logic** (Lines 1404-1406):
  ```tsx
  use_splits: useSplits,
  split_ratio_a: Number(splitRatioA),
  split_ratio_b: Number(splitRatioB),
  ```
- **Finding**: There are no upper or lower bound validation checks (e.g. `0 <= val <= 100`), non-integer constraints, or integer parsing. In addition, when Ratio A is cleared (`""`), both values are saved as `0`, which violates the `sum === 100` business rule.

### B. Signature Pad Click-Through & Discarded Data (`src/pages/QuotePortalPage.tsx`)
- **Signature Activation** (Lines 69-82 & 102-115):
  ```tsx
  const handleStartA = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    ...
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawingA(true);
    setSignedA(true);
  };
  ```
- **Quote Acceptance Action** (Lines 517-520):
  ```tsx
  const onAcceptQuoteBtnClick = async () => {
    const signatureUrl = canvasRefA.current?.toDataURL("image/png") || "mock-signature-url";
    await handleAcceptQuote(signatureUrl, quote?.contact?.fullName || "Client Dual Signature");
  };
  ```
- **Finding**: Both signature pads set their respective `signedA` / `signedB` states to `true` instantly on mouse down / touch start, enabling the accept button without any actual strokes drawn. Additionally, `onAcceptQuoteBtnClick` completely ignores and discards the signature from `canvasRefB`.

### C. Xero Integration Setting Bypass (`src/pages/CalculatorV3Page.tsx` & `supabase/functions/xero-invoice/index.ts`)
- **Sync Trigger button** (Lines 2441-2451):
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
- **Edge Function Sync Action** (Lines 28-35 in `supabase/functions/xero-invoice/index.ts`):
  ```ts
  const { error } = await supabase
    .from("quotes")
    .update({
      xero_invoice_id: "XERO-INV-12345",
      xero_sync_status: "Synced",
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
  ```
- **Finding**: The sync button is rendered and clickable unconditionally on the accepted status of a quote. The Edge function executes database updates unconditionally. The `xero_enabled` setting from `quote_settings` is completely ignored.

### D. Private Comments Leakage (`src/components/quote/QuoteComments.tsx`)
- **Comments Selector** (Lines 35-39):
  ```tsx
  const { data, error } = await supabase
    .from("quote_comments")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });
  ```
- **Finding**: The public client portal retrieves ALL comments associated with a quote id, including those with `is_private = true`. The UI has no logic to filter these out, leaking private internal notes directly to clients.

### E. Database RLS Gaps (`supabase/migrations/032_quote_portal.sql` & `supabase/migrations/033_quotient_integration.sql`)
- **Quotes Select Policy**:
  ```sql
  CREATE POLICY "Allow public select quotes" ON quotes FOR SELECT USING (true);
  ```
- **Installers and Settings CRUD Policies**:
  ```sql
  CREATE POLICY "Allow public CRUD" ON installers FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow public CRUD" ON quote_settings FOR ALL USING (true) WITH CHECK (true);
  ```
- **Finding**: There is no isolation between different organizations or users. Any client can SELECT all quotes, insert/modify/delete installers, or change brand settings of any company in the database.

---

## 2. Logic Chain
1. **Invalid Splits Ratios**:
   - Because `handleRatioAChange` sets `setSplitRatioA(val)` and `setSplitRatioB(100 - val)` without checking whether `val` is negative or $>100$, negative/overflow percentages are saved directly.
   - Because `Number("")` evaluates to `0`, leaving the input field blank writes a split of $0\% / 0\%$, which fails the mathematical total check.
2. **Signature Pad Bypass & Loss**:
   - Because `setSignedA(true)` runs during `onMouseDown`/`onTouchStart` (before any move event), a simple tap registers the pad as "signed".
   - Because `onAcceptQuoteBtnClick` calls `toDataURL()` exclusively on `canvasRefA`, the Client B signature on `canvasRefB` is completely dropped and never sent to the backend.
3. **Xero Settings Bypass**:
   - Because `CalculatorV3Page` does not check `xeroEnabled` setting before displaying the Sync button, and the edge function does not query the settings table, syncing works even if Xero is disabled.
4. **Comments Info Leak**:
   - Because `QuoteComments.tsx` executes `select("*")` on `quote_comments` and lacks RLS or client-side filtering on `is_private`, internal staff comments are exposed on the customer's portal.
5. **RLS Multi-tenant Data Leak**:
   - Because SQL policies use `USING (true)` and `WITH CHECK (true)` for public access, there is no ownership validation. Anyone can access or corrupt any entry.

---

## 3. Caveats
- This audit did not cover network performance limits, API gateway rate limits, or Supabase JWT token expiration issues.
- It is assumed that Cypress tests run in a mock database sandbox; in real production, `USING (true)` policies pose extreme security risks and must be locked down.

---

## 4. Conclusion
The Quotient Integration is functional for happy paths but suffers from critical logic bypasses, input validation gaps, data loss (Client B signature), information disclosure (private comments leaked), and severe RLS security vulnerabilities. 

---

## 5. Verification Method (Proposed Adversarial Test Suite)
To verify these gaps, add the following test cases to `cypress/e2e/quotient_integration.cy.js` and run `npm run cy:run`:

### A. Test Case: Adversarial Split Ratios
```javascript
it("adversarial: should validate split ratios and reject invalid values", () => {
  cy.visit("/quote/mock-quote-id");
  cy.get('[data-testid="quote-split-checkbox"]').check();

  // Test Negative Split A
  cy.get('[data-testid="quote-split-ratio-a"]').clear().type("-10");
  cy.get('[data-testid="save-quote-btn"]').click();
  cy.get('[data-testid="quote-split-ratio-a"]').should("have.class", "border-danger"); // Or verify error toast

  // Test Blank Split A
  cy.get('[data-testid="quote-split-ratio-a"]').clear();
  cy.get('[data-testid="save-quote-btn"]').click();
  cy.contains("Split ratios must sum to 100").should("exist");
});
```

### B. Test Case: Empty Signature & Dual Signature Capture
```javascript
it("adversarial: should prevent empty signatures and capture both pads", () => {
  cy.visit("/q/mock-client-quote-id");
  cy.get('[placeholder="Enter your email"]').clear().type("client@example.com");

  // Single click on pads (mousedown then mouseup without moving)
  cy.get('[data-testid="client-a-signature-pad"]').trigger("mousedown", { force: true }).trigger("mouseup", { force: true });
  cy.get('[data-testid="client-b-signature-pad"]').trigger("mousedown", { force: true }).trigger("mouseup", { force: true });

  // Accept button must remain disabled
  cy.get('[data-testid="accept-quote-btn"]').should("be.disabled");

  // Draw real signature
  cy.get('[data-testid="client-a-signature-pad"]')
    .trigger("mousedown", { which: 1, force: true })
    .trigger("mousemove", { clientX: 50, clientY: 50, force: true })
    .trigger("mouseup", { force: true });
  cy.get('[data-testid="client-b-signature-pad"]')
    .trigger("mousedown", { which: 1, force: true })
    .trigger("mousemove", { clientX: 150, clientY: 150, force: true })
    .trigger("mouseup", { force: true });

  cy.get('[data-testid="accept-quote-btn"]').should("not.be.disabled").click({ force: true });
  // Verify both signature fields populated in db/intercept payload
});
```

### C. Test Case: Disabled Xero Sync Prevention
```javascript
it("adversarial: should block Xero sync if disabled in settings", () => {
  // Disable Xero in settings
  cy.visit("/admin/settings");
  cy.get('[data-testid="setting-xero-enabled"]').uncheck();
  cy.get('[data-testid="settings-save-btn"]').click();

  // Go to staff view of accepted quote
  cy.visit("/quote/mock-client-quote-id");
  cy.get('[data-testid="trigger-xero-invoice-btn"]').should("be.disabled"); // Or not exist
});
```

### D. Test Case: Private Comments Privacy
```javascript
it("adversarial: should not expose private staff comments in public portal", () => {
  const commentText = "INTERNAL ONLY NOTE: Customer is highly price sensitive";
  
  // Post private comment as staff
  cy.visit("/quote/mock-client-quote-id");
  cy.get('[data-testid="comment-text-input"]').type(commentText);
  cy.get('[data-testid="comment-private-checkbox"]').check();
  cy.get('[data-testid="comment-submit-btn"]').click();

  // Load public client portal anonymously
  cy.clearLocalStorage();
  cy.visit("/q/mock-client-quote-id");
  
  // Should not contain the private comment
  cy.get('[data-testid="comments-list"]').should("not.contain", commentText);
});
```
