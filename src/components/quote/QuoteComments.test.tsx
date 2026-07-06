import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteComments } from "./QuoteComments";

const queryTracker: string[][] = [];

vi.mock("../../lib/supabase", () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(function(this: any, key: string, val: string) {
      queryTracker.push([key, val]);
      return this;
    }),
    order: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: any, resolve: any) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    })
  };

  return {
    isSupabaseConfigured: false,
    supabase: {
      from: vi.fn().mockReturnValue(mockQuery),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis()
      }),
      removeChannel: vi.fn().mockResolvedValue({})
    }
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("QuoteComments multi-tenant scoping", () => {
  beforeEach(() => {
    queryTracker.length = 0;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("filters comments by orgId when orgId is provided", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QuoteComments
          quoteId="mock-quote-1"
          currentUser={{ email: "admin@example.com", name: "Admin", role: "admin" }}
          orgId="test-org-123"
        />
      );
    });

    // Let any async tasks / useEffects run
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    // Check if the org_id query filter was applied
    const orgIdFilter = queryTracker.find(([key]) => key === "org_id");
    expect(orgIdFilter).toBeDefined();
    expect(orgIdFilter?.[1]).toBe("test-org-123");

    act(() => root.unmount());
  });

  it("does not filter comments by orgId when orgId is omitted", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QuoteComments
          quoteId="mock-quote-2"
          currentUser={{ email: "admin@example.com", name: "Admin", role: "admin" }}
        />
      );
    });

    // Let any async tasks / useEffects run
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    // Check that org_id was not queried
    const orgIdFilter = queryTracker.find(([key]) => key === "org_id");
    expect(orgIdFilter).toBeUndefined();

    act(() => root.unmount());
  });
});
