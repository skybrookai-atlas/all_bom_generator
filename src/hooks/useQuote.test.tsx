import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchQuoteFn } from "./useQuote";

// Mock supabase client
vi.mock("../lib/supabase", () => {
  return {
    isSupabaseConfigured: false,
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              throw new Error("Supabase offline");
            },
            order: () => ({
              order: async () => {
                throw new Error("Supabase offline");
              }
            })
          })
        })
      })
    }
  };
});

describe("useQuote fallback tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to localStorage when Supabase fails", async () => {
    const mockLocalQuote = {
      id: "local-id-123",
      org_id: "local-org",
      user_id: "local-user",
      quote_number: 1,
      customer_ref: "Local Saved Customer",
      fence_config: {
        calculator: "v3",
        jobName: "Local Job",
        payload: {
          productCode: "QSHS",
          schemaVersion: "v1",
          variables: {},
          runs: []
        }
      },
      gates: [],
      bom: {},
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    localStorage.setItem("qsbom-quotes", JSON.stringify([mockLocalQuote]));

    const result = await fetchQuoteFn("local-id-123");
    expect(result.quote.customer_ref).toBe("Local Saved Customer");
    expect(result.payload.productCode).toBe("QSHS");
  });

  it("returns default mock quote if not found in localStorage", async () => {
    const result = await fetchQuoteFn("mock-quote-id");
    expect(result.quote.id).toBe("mock-quote-id");
    expect(result.quote.customer_ref).toBe("Mock Customer");
    expect(result.quote.org_id).toBe("00000000-0000-0000-0000-000000000001");
  });
});
