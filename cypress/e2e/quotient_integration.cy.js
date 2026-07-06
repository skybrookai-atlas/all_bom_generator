describe("Quotient Integration E2E Test Suite", () => {
  const session = {
    access_token: "mock-session-token",
    refresh_token: "mock-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email: "admin@glass-outlet.com",
      app_metadata: {},
      user_metadata: {},
    },
  };

  beforeEach(() => {
    // Set up mock auth token in localStorage before each test
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
      },
    });
  });

  // ==========================================
  // Feature 1: Database Schema Verification
  // ==========================================
  describe("Feature 1: Database Schema Verification", () => {
    it("should display and validate new database fields on the quote editor page", () => {
      // Navigate to a specific quote editor page
      cy.visit("/quote/mock-quote-id");

      // Verify Quote fields: installer dropdown/select and installation date picker
      cy.get('[data-testid="quote-assigned-installer"]').should("exist");
      cy.get('[data-testid="quote-install-date"]').should("exist");

      // Verify we can interact with Quote fields
      cy.get('[data-testid="quote-assigned-installer"]').select("Installer John Doe");
      cy.get('[data-testid="quote-install-date"]').type("2026-07-15");

      // Verify Quote Comments fields
      cy.get('[data-testid="comment-text-input"]').should("exist");
      cy.get('[data-testid="comment-private-checkbox"]').should("exist");
      cy.get('[data-testid="comment-submit-btn"]').should("exist");

      // Verify Quote Comments interaction
      cy.get('[data-testid="comment-text-input"]').type("This is an internal E2E test comment.");
      cy.get('[data-testid="comment-private-checkbox"]').check();
      cy.get('[data-testid="comment-submit-btn"]').click();

      // Comment should be displayed in the list
      cy.get('[data-testid="comments-list"]').should("contain", "This is an internal E2E test comment.");
      cy.get('[data-testid="comment-private-badge"]').should("exist");
    });

    it("should display and validate new database fields on the settings & installers pages", () => {
      // Visit settings page to verify brand and invoicing configurations
      cy.visit("/admin/settings");

      // Check fields for quote_settings table mapping
      cy.get('[data-testid="setting-logo-url"]').should("exist");
      cy.get('[data-testid="setting-primary-color"]').should("exist");
      cy.get('[data-testid="setting-secondary-color"]').should("exist");
      cy.get('[data-testid="setting-default-deposit"]').should("exist");
      cy.get('[data-testid="setting-xero-enabled"]').should("exist");

      // Verify settings update
      cy.get('[data-testid="setting-logo-url"]').clear().type("https://example.com/logo.png");
      cy.get('[data-testid="setting-primary-color"]').clear().type("#007bff");
      cy.get('[data-testid="setting-default-deposit"]').clear().type("15");
      cy.get('[data-testid="setting-xero-enabled"]').check();
      cy.get('[data-testid="settings-save-btn"]').click();

      // Visit installers management page to verify installer schema mapping
      cy.visit("/admin/installers");

      // Verify fields for installers table mapping
      cy.get('[data-testid="installer-name"]').should("exist");
      cy.get('[data-testid="installer-email"]').should("exist");
      cy.get('[data-testid="installer-phone"]').should("exist");
      cy.get('[data-testid="installer-status"]').should("exist");

      // Create a new installer to test writes
      cy.get('[data-testid="installer-name"]').type("Jane Smith");
      cy.get('[data-testid="installer-email"]').type("jane@example.com");
      cy.get('[data-testid="installer-phone"]').type("0412345678");
      cy.get('[data-testid="installer-status"]').select("Active");
      cy.get('[data-testid="installer-save-btn"]').click();

      // Verify the installer appears in the list
      cy.get('[data-testid="installer-list-row"]').should("contain", "Jane Smith");
    });
  });

  // ==========================================
  // Feature 2: Dashboard & Settings
  // ==========================================
  describe("Feature 2: Dashboard & Settings", () => {
    beforeEach(() => {
      cy.visit("/quotes");
    });

    it("should render the recent quotes list and status filter controls", () => {
      // Verify recent quotes list container and row presence
      cy.get('[data-testid="recent-quotes-list"]').should("be.visible");
      cy.get('[data-testid="quote-row"]').should("have.length.greaterThan", 0);

      // Verify status filter exists (e.g. Sent, Accepted, Draft, Declined)
      cy.get('[data-testid="quote-status-filter"]').should("exist");

      // Select 'Accepted' status filter and assert list filters accordingly
      cy.get('[data-testid="status-filter-accepted"]').click();
      cy.get('[data-testid="quote-row"]').each(($el) => {
        cy.wrap($el).find('[data-testid="quote-status-badge"]').should("have.text", "Accepted");
      });
    });

    it("should display quotes metrics and analytics charts on the dashboard", () => {
      // Verify dashboard charts and summary stats
      cy.get('[data-testid="quotes-analytics-chart"]').should("be.visible");
      cy.get('[data-testid="total-quotes-metric"]').should("be.visible");
      cy.get('[data-testid="acceptance-rate-metric"]').should("be.visible");
    });

    it("should display the installer availability sidebar and enable installers admin", () => {
      // Verify installer availability sidebar on dashboard
      cy.get('[data-testid="installer-availability-sidebar"]').should("be.visible");
      cy.get('[data-testid="installer-availability-row"]').should("exist");

      // Click button to manage installers and verify redirection or modal
      cy.get('[data-testid="manage-installers-btn"]').click();
      cy.url().should("include", "/admin/installers");

      // Verify installer list CRUD operations
      cy.get('[data-testid="installer-list-row"]').first().within(() => {
        cy.get('[data-testid="edit-installer-btn"]').should("be.visible");
        cy.get('[data-testid="delete-installer-btn"]').should("be.visible");
      });
    });

    it("should verify and update company branding settings", () => {
      cy.visit("/admin/settings");

      // Set and save branding values
      cy.get('[data-testid="setting-logo-url"]').clear().type("https://example.com/logo-v2.png");
      cy.get('[data-testid="setting-primary-color"]').clear().type("#ff0000");
      cy.get('[data-testid="settings-save-btn"]').click();

      // Verify branding settings are retained on refresh
      cy.reload();
      cy.get('[data-testid="setting-logo-url"]').should("have.value", "https://example.com/logo-v2.png");
      cy.get('[data-testid="setting-primary-color"]').should("have.value", "#ff0000");
    });
  });

  // ==========================================
  // Feature 3: Quote Editor & Canvas Modal
  // ==========================================
  describe("Feature 3: Quote Editor & Canvas Modal", () => {
    beforeEach(() => {
      cy.visit("/quote/mock-quote-id");
    });

    it("should support client split ratio configuration", () => {
      // Enable client splits
      cy.get('[data-testid="quote-split-checkbox"]').check();

      // Assert split ratio inputs are visible
      cy.get('[data-testid="quote-split-ratio-a"]').should("be.visible");
      cy.get('[data-testid="quote-split-ratio-b"]').should("be.visible");

      // Set split ratios (e.g. 60 / 40)
      cy.get('[data-testid="quote-split-ratio-a"]').clear().type("60");
      cy.get('[data-testid="quote-split-ratio-b"]').should("have.value", "40"); // Auto-calculated

      // Save split configuration
      cy.get('[data-testid="save-quote-btn"]').click();
      cy.get('[data-testid="quote-split-ratio-a"]').should("have.value", "60");
    });

    it("should support adding manual/custom items to the BOM", () => {
      // Click 'Add manual item' button
      cy.get('[data-testid="add-manual-item-btn"]').click();

      // Check modal inputs
      cy.get('[data-testid="manual-item-sku"]').type("CUSTOM-POST-EXT");
      cy.get('[data-testid="manual-item-name"]').type("Custom Post Extension Bracket");
      cy.get('[data-testid="manual-item-qty"]').type("4");
      cy.get('[data-testid="manual-item-price"]').type("25.50");

      // Save the manual item
      cy.get('[data-testid="save-manual-item-btn"]').click();

      // Verify the item is added to the BOM table
      cy.get('[data-testid="bom-table"]').within(() => {
        cy.contains('[data-testid="bom-row-code"]', "CUSTOM-POST-EXT").should("exist");
        cy.get('[data-testid="bom-row-qty"]').should("contain", "4");
        cy.get('[data-testid="bom-row-unit-price"]').should("contain", "25.50");
        cy.get('[data-testid="bom-row-line-total"]').should("contain", "102.00");
      });
    });

    it("should list available quote templates and allow loading them", () => {
      // Verify templates list dropdown or container
      cy.get('[data-testid="quote-templates-list"]').should("exist");

      // Select a template (e.g. "Standard 3-Panel Side Entrance Gate")
      cy.get('[data-testid="quote-templates-list"]').select("Standard 3-Panel Gate");

      // Verify layout variables are auto-filled based on the template
      cy.get('[data-testid="system-type"]').should("have.value", "QSHS");
      cy.get('[data-testid="run-length"]').should("have.value", "7500");
    });

    it("should open, edit and save drawing in the canvas overlay modal", () => {
      // Click button to open canvas modal
      cy.get('[data-testid="open-canvas-modal-btn"]').click();

      // Verify overlay modal opens
      cy.get('[data-testid="canvas-overlay-modal"]').should("be.visible");
      cy.get('[data-testid="canvas-drawing-area"]').should("be.visible");

      // Perform a mock canvas interaction or set drawing settings inside modal
      cy.get('[data-testid="canvas-zoom-in-btn"]').click();
      cy.get('[data-testid="canvas-toggle-satellite-btn"]').click();

      // Save drawing and close modal
      cy.get('[data-testid="save-canvas-modal-btn"]').click();
      cy.get('[data-testid="canvas-overlay-modal"]').should("not.exist");

      // Verify BOM gets updated after closing the drawing modal
      cy.get('[data-testid="bom-table"]').should("be.visible");
    });

    it("should toggle between summary and exploded BOM formats", () => {
      // Locate toggle button or dropdown
      cy.get('[data-testid="bom-view-toggle"]').should("exist");

      // Toggle to Summary View
      cy.get('[data-testid="bom-format-summary"]').click();
      cy.get('[data-testid="bom-table"]').should("have.class", "bom-summary-format");

      // Toggle to Exploded View
      cy.get('[data-testid="bom-format-exploded"]').click();
      cy.get('[data-testid="bom-table"]').should("have.class", "bom-exploded-format");
    });
  });

  // ==========================================
  // Feature 4: Client Portal & Xero integration
  // ==========================================
  describe("Feature 4: Client Portal & Xero integration", () => {
    beforeEach(() => {
      // Visit the client portal page for a specific quote
      cy.visit("/q/mock-client-quote-id");
    });

    it("should display the quote in the client portal, allowing quantity adjustments and optional items", () => {
      // Verify portal displays the quote info
      cy.get('[data-testid="client-quote-header"]').should("be.visible");

      // Verify client-editable quantities (e.g. adjust custom items or extra-posts count)
      cy.get('[data-testid="client-qty-input-CUSTOM-POST-EXT"]').should("exist");
      cy.get('[data-testid="client-qty-input-CUSTOM-POST-EXT"]').scrollIntoView().clear({ force: true }).type("6", { force: true });

      // Verify Optional Checkbox items (e.g. post caps, premium locks, sliding gate motor)
      cy.get('[data-testid="optional-item-checkbox-SLIDING-MOTOR"]').should("exist");
      cy.get('[data-testid="optional-item-checkbox-SLIDING-MOTOR"]').scrollIntoView().check({ force: true });

      // Assert total price updates accordingly after quantity and option changes
      cy.get('[data-testid="client-quote-total"]').should("contain", "Updated Total");
    });

    it("should support dual signature pads, deposit calculation, and quote acceptance", () => {
      // Assert dual signature pads are present
      cy.get('[data-testid="client-a-signature-pad"]').scrollIntoView().should("be.visible");
      cy.get('[data-testid="client-b-signature-pad"]').scrollIntoView().should("be.visible");

      // Perform signature actions (mousedown, mousemove, mouseup) on signature pad A
      cy.get('[data-testid="client-a-signature-pad"]')
        .trigger("mousedown", { which: 1, eventConstructor: "MouseEvent", force: true })
        .trigger("mousemove", { clientX: 100, clientY: 100, eventConstructor: "MouseEvent", force: true })
        .trigger("mouseup", { force: true });

      // Perform signature actions on signature pad B
      cy.get('[data-testid="client-b-signature-pad"]')
        .trigger("mousedown", { which: 1, eventConstructor: "MouseEvent", force: true })
        .trigger("mousemove", { clientX: 200, clientY: 200, eventConstructor: "MouseEvent", force: true })
        .trigger("mouseup", { force: true });

      // Check accept quote button becomes enabled and click it
      cy.get('[data-testid="accept-quote-btn"]').should("not.be.disabled").click({ force: true });

      // Verify acceptance confirmation modal or status change
      cy.get('[data-testid="quote-accepted-success-alert"]').scrollIntoView().should("be.visible");

      // Verify deposit calculation display (based on 15% setting configured in settings test)
      cy.get('[data-testid="deposit-amount"]').should("contain", "15%");

      // Click pay deposit button
      cy.get('[data-testid="pay-deposit-btn"]').scrollIntoView().should("be.visible").click({ force: true });
      cy.get('[data-testid="payment-modal"]').should("be.visible");
    });

    it("should support Xero integration invoice generation trigger from the staff side", () => {
      // Visit the staff view of the accepted quote
      cy.visit("/quote/mock-client-quote-id");

      // Verify sync status indicator
      cy.get('[data-testid="xero-sync-status"]').scrollIntoView().should("exist");

      // Trigger Xero invoice generation
      cy.get('[data-testid="trigger-xero-invoice-btn"]').scrollIntoView().should("be.visible").click({ force: true });

      // Verify the success state is reflected on the screen
      cy.get('[data-testid="xero-sync-status"]').should("contain", "Synced");
      cy.get('[data-testid="xero-invoice-id"]').should("exist");
    });

    // ==========================================
    // Adversarial Test Cases
    // ==========================================
    it("should validate and clamp split ratios (adversarial)", () => {
      cy.visit("/quote/mock-quote-id");

      // Enable client splits
      cy.get('[data-testid="quote-split-checkbox"]').check();

      // Clamp split Ratio A input: val = Math.max(0, Math.min(100, Number(rawVal)))
      // If we type -10, it should clamp to 0
      cy.get('[data-testid="quote-split-ratio-a"]').clear().type("-10");
      cy.get('[data-testid="quote-split-ratio-a"]').invoke("val").then((val) => {
        expect(Number(val)).to.eq(0);
      });

      // If we type 150, it should clamp to 100
      cy.get('[data-testid="quote-split-ratio-a"]').clear().type("150");
      cy.get('[data-testid="quote-split-ratio-a"]').invoke("val").then((val) => {
        expect(Number(val)).to.eq(100);
      });

      // Empty input should be blocked on save
      cy.get('[data-testid="quote-split-ratio-a"]').clear();
      cy.get('[data-testid="save-quote-btn"]').click();
      cy.contains("Split ratios must be valid numbers that sum to 100").should("be.visible");
    });

    it("should block empty signature click-through and capture dual signatures (adversarial)", () => {
      cy.visit("/q/mock-client-quote-id");

      // Clear local storage quote cache to start fresh
      cy.clearLocalStorage();

      // Accept button should be disabled initially
      cy.get('[data-testid="accept-quote-btn"]').should("be.disabled");

      // Click on canvas A without drawing
      cy.get('[data-testid="client-a-signature-pad"]').click({ force: true });
      cy.get('[data-testid="accept-quote-btn"]').should("be.disabled");

      // Draw on Pad A
      cy.get('[data-testid="client-a-signature-pad"]')
        .trigger("mousedown", { which: 1, eventConstructor: "MouseEvent", force: true })
        .trigger("mousemove", { clientX: 100, clientY: 100, eventConstructor: "MouseEvent", force: true })
        .trigger("mouseup", { force: true });

      // Still disabled since B is not signed
      cy.get('[data-testid="accept-quote-btn"]').should("be.disabled");

      // Click on canvas B without drawing
      cy.get('[data-testid="client-b-signature-pad"]').click({ force: true });
      cy.get('[data-testid="accept-quote-btn"]').should("be.disabled");

      // Draw on Pad B
      cy.get('[data-testid="client-b-signature-pad"]')
        .trigger("mousedown", { which: 1, eventConstructor: "MouseEvent", force: true })
        .trigger("mousemove", { clientX: 200, clientY: 200, eventConstructor: "MouseEvent", force: true })
        .trigger("mouseup", { force: true });

      // Enabled now
      cy.get('[data-testid="accept-quote-btn"]').should("not.be.disabled").click({ force: true });

      // Verify acceptance confirmation modal or status change
      cy.get('[data-testid="quote-accepted-success-alert"]').should("be.visible");

      // Verify both signature images are captured and displayed
      cy.get('[alt="Captured client signature A"]').should("exist");
      cy.get('[alt="Captured client signature B"]').should("exist");
    });

    it("should disable Xero sync button when Xero is disabled in branding settings (adversarial)", () => {
      // 1. Visit settings page to disable Xero
      cy.visit("/admin/settings");
      cy.get('[data-testid="setting-xero-enabled"]').uncheck();
      cy.get('[data-testid="settings-save-btn"]').click();

      // 2. Visit the staff view of the quote
      cy.visit("/quote/mock-client-quote-id");

      // 3. Verify sync status button is disabled
      cy.get('[data-testid="trigger-xero-invoice-btn"]').should("be.disabled");

      // Cleanup: Re-enable Xero
      cy.visit("/admin/settings");
      cy.get('[data-testid="setting-xero-enabled"]').check();
      cy.get('[data-testid="settings-save-btn"]').click();
    });

    it("should hide private comments posted by staff from public client portal (adversarial)", () => {
      // 1. Visit staff view and post a private comment
      cy.visit("/quote/mock-quote-id");
      cy.get('[data-testid="comment-text-input"]').type("Private comment text from staff");
      cy.get('[data-testid="comment-private-checkbox"]').check();
      cy.get('[data-testid="comment-submit-btn"]').click();

      // Verify it is displayed in the staff view
      cy.get('[data-testid="comments-list"]').should("contain", "Private comment text from staff");

      // 2. Visit client portal view
      cy.visit("/q/mock-quote-id");

      // Verify the private comment is NOT displayed
      cy.contains("Private comment text from staff").should("not.exist");
    });
  });
});

