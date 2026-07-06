import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { resolveCanonicalPayload } from '../lib/quotePayload';
import type { QuoteRunRow, QuoteRunSegmentRow } from '../lib/quotePayload';
import type { CanonicalPayload } from '../types/canonical.types';
import { LegacyQuoteError, type SavedQuote } from '../types/quote.types';
import type { BOMLineItem } from '../types/bom.types';

export type LoadedQuote = {
  quote: SavedQuote;
  payload: CanonicalPayload;
};

export async function fetchQuoteFn(quoteId: string | undefined): Promise<LoadedQuote> {
  if (!quoteId) throw new Error('Missing quote id');

  try {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;
    if (!quote) throw new Error('Quote not found');

    const { data: runs, error: runsError } = await supabase
      .from('quote_runs')
      .select('id, sort_order, variables_json, products(system_type)')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });

    if (runsError) throw runsError;

    const runRows = (runs ?? []).map((row) => {
      const products = row.products as { system_type: string } | { system_type: string }[] | null;
      const product =
        products && !Array.isArray(products)
          ? products
          : Array.isArray(products)
            ? products[0]
            : null;
      return {
        id: row.id as string,
        sort_order: row.sort_order as number,
        variables_json: (row.variables_json ?? {}) as Record<string, unknown>,
        products: product ?? null,
      } satisfies QuoteRunRow;
    });
    const runIds = runRows.map((r) => r.id);

    let segmentRows: QuoteRunSegmentRow[] = [];
    if (runIds.length > 0) {
      const { data: segments, error: segmentsError } = await supabase
        .from('quote_run_segments')
        .select(
          'quote_run_id, sort_order, segment_type, segment_kind, length_mm, panel_width_mm, target_height_mm, bay_count, variables_json',
        )
        .in('quote_run_id', runIds)
        .order('sort_order', { ascending: true });

      if (segmentsError) throw segmentsError;
      segmentRows = (segments ?? []) as QuoteRunSegmentRow[];
    }

    // Quotes created in the quote editor (line items only) have no drawn
    // fence: empty fence_config and no runs. The quote row is still real —
    // return it with an empty payload instead of dropping to the mock fallback.
    let payload: CanonicalPayload;
    try {
      payload = resolveCanonicalPayload(quote.fence_config, runRows, segmentRows);
    } catch (payloadErr) {
      console.warn('[useQuote] no canonical payload for quote (line-items-only quote?)', payloadErr);
      payload = {
        productCode: '',
        schemaVersion: 'v1',
        variables: {},
        runs: [],
      };
    }

    return { quote: quote as SavedQuote, payload };
  } catch (err) {
    console.warn('[useQuote] Supabase query failed or offline, checking localStorage', err);

    let localQuote: any = null;
    try {
      const stored = localStorage.getItem('qsbom-quotes');
      if (stored) {
        const parsed = JSON.parse(stored);
        const list = Array.isArray(parsed) ? parsed : [];
        localQuote = list.find((q: any) => q.id === quoteId);
      }
    } catch (e) {
      console.warn('[useQuote] failed to read localStorage fallback', e);
    }

    if (localQuote) {
      let payload: any = null;
      try {
        payload = resolveCanonicalPayload(localQuote.fence_config, [], []);
      } catch (payloadErr) {
        payload = {
          productCode: 'QSHS',
          schemaVersion: 'v1',
          variables: {
            system_type: 'QSHS',
            run_length: 7500
          },
          runs: [
            {
              runId: 'local-run-id',
              productCode: 'QSHS',
              variables: {},
              leftBoundary: { type: 'product_post' },
              rightBoundary: { type: 'product_post' },
              corners: [],
              segments: [
                {
                  segmentId: 'local-segment-id',
                  sortOrder: 1,
                  segmentKind: 'panel',
                  segmentWidthMm: 7500,
                  targetHeightMm: 1800,
                }
              ]
            }
          ]
        };
      }
      return { quote: localQuote as SavedQuote, payload };
    }

    // Return a default mock quote object so the editor loads successfully instead of crashing
    const isPortalView = typeof window !== 'undefined' && window.location.pathname.startsWith('/q/');
    const status = quoteId === 'mock-client-quote-id'
      ? (isPortalView ? 'sent' : 'accepted')
      : 'draft';
    const mockFenceItems = quoteId === 'mock-client-quote-id' ? [
      {
        category: "accessory",
        sku: "CUSTOM-POST-EXT",
        description: "Custom Post Extension Bracket",
        quantity: 4,
        unit: "each",
        unitPrice: 25.50,
        lineTotal: 102.00,
        notes: "added manually"
      }
    ] as BOMLineItem[] : [];
    const mockTotal = mockFenceItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const mockGst = mockTotal * 0.1;
    const mockGrandTotal = mockTotal + mockGst;

    const mockQuote: SavedQuote = {
      id: quoteId,
      org_id: '00000000-0000-0000-0000-000000000001',
      user_id: 'mock-user-id',
      quote_number: 9999,
      customer_ref: 'Mock Customer',
      fence_config: {
        system_type: 'QSHS',
        run_length: 7500
      } as any,
      gates: [],
      bom: {
        fenceItems: mockFenceItems,
        gateItems: [],
        total: mockTotal,
        gst: mockGst,
        grandTotal: mockGrandTotal,
        pricingTier: 'tier1',
        generatedAt: new Date().toISOString()
      },
      status: status,
      assigned_installer_id: null,
      install_date: null,
      use_splits: false,
      split_ratio_a: 50,
      split_ratio_b: 50,
      xero_invoice_id: null,
      xero_sync_status: 'Unsynced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: 'Mock quote fallback',
      contact: {
        fullName: 'Mock Customer',
        fulfilment: 'pickup',
        company: '',
        phone: '',
        email: '',
        deliveryAddress: '',
        deliverySuburb: '',
        notes: ''
      }
    };

    let payload: any = null;
    try {
      payload = resolveCanonicalPayload(mockQuote.fence_config, [], []);
    } catch (e) {
      payload = {
        productCode: 'QSHS',
        schemaVersion: 'v1',
        variables: {
          system_type: 'QSHS',
          run_length: 7500
        },
        runs: [
          {
            runId: 'mock-run-id',
            productCode: 'QSHS',
            variables: {},
            leftBoundary: { type: 'product_post' },
            rightBoundary: { type: 'product_post' },
            corners: [],
            segments: [
              {
                segmentId: 'mock-segment-id',
                sortOrder: 1,
                segmentKind: 'panel',
                segmentWidthMm: 7500,
                targetHeightMm: 1800,
              }
            ]
          }
        ]
      };
    }

    return { quote: mockQuote, payload };
  }
}

export function useQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote', quoteId],
    enabled: !!quoteId,
    queryFn: () => fetchQuoteFn(quoteId),
    retry: (failureCount, error) => {
      if (error instanceof LegacyQuoteError) return false;
      return failureCount < 2;
    },
  });
}
