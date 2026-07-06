import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import type { SavedQuote, NewQuote, QuoteListItem } from '../types/quote.types';
import {
  formatCreatorLabel,
  getJobName,
  getLayoutCounts,
  getQuoteGrandTotal,
  getQuoteSystemLabel,
  type QuoteDbRun,
} from '../lib/quoteListMeta';

function toQuoteListItem(
  quote: SavedQuote & { quote_runs?: QuoteDbRun[] },
  profileMap: Map<string, string | null>,
): QuoteListItem {
  const dbRuns = quote.quote_runs;
  const layout = getLayoutCounts(quote, dbRuns);

  return {
    ...quote,
    jobName: getJobName(quote),
    creatorName: profileMap.get(quote.user_id) ?? null,
    runCount: layout.runs,
    segmentCount: layout.segments,
    gateCount: layout.gates,
    systemLabel: getQuoteSystemLabel(quote),
    displayTotal: getQuoteGrandTotal(quote),
    quote_runs: dbRuns,
  };
}

export function useQuotes() {
  const quotesQuery = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      // 1. Seed initial quotes to localStorage if empty
      const localStr = localStorage.getItem('qsbom-quotes');
      let localQuotes: SavedQuote[] = [];
      if (localStr) {
        try {
          localQuotes = JSON.parse(localStr);
        } catch (e) {
          // ignore parsing errors
        }
      }

      if (!localQuotes || localQuotes.length === 0) {
        localQuotes = [
          {
            id: "11111111-1111-1111-1111-111111111111",
            org_id: "99999999-9999-9999-9999-999999999999",
            user_id: "00000000-0000-0000-0000-000000000001",
            quote_number: 1001,
            customer_ref: "Draft Project",
            property_anchor: null,
            fence_config: {
              calculator: "v3",
              jobName: "Draft Project",
              payload: {
                productCode: "QuickScreen",
                schemaVersion: "1.0",
                variables: {},
                runs: [
                  {
                    runId: "run-1",
                    productCode: "QuickScreen",
                    segments: [
                      { segmentId: "seg-1", sortOrder: 1, kind: "fence", segmentKind: "panel" }
                    ]
                  }
                ]
              }
            },
            gates: [],
            bom: {
              grandTotal: 1200,
              items: []
            } as any,
            contact: {
              fullName: "Jane Doe",
              email: "jane@example.com",
              phone: "0400111222",
              fulfilment: "pickup",
              company: "",
              deliveryAddress: "123 Main St",
              deliverySuburb: "",
              notes: ""
            },
            notes: "",
            status: "draft",
            created_at: "2026-06-29T12:00:00.000Z",
            updated_at: "2026-06-29T12:00:00.000Z"
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            org_id: "99999999-9999-9999-9999-999999999999",
            user_id: "00000000-0000-0000-0000-000000000001",
            quote_number: 1002,
            customer_ref: "Accepted Project",
            property_anchor: null,
            fence_config: {
              calculator: "v3",
              jobName: "Accepted Project",
              payload: {
                productCode: "QuickScreen",
                schemaVersion: "1.0",
                variables: {},
                runs: [
                  {
                    runId: "run-2",
                    productCode: "QuickScreen",
                    segments: [
                      { segmentId: "seg-2", sortOrder: 1, kind: "fence", segmentKind: "panel" },
                      { segmentId: "seg-3", sortOrder: 2, kind: "gate", segmentKind: "gate_opening" }
                    ]
                  }
                ]
              }
            },
            gates: [],
            bom: {
              grandTotal: 2500,
              items: []
            } as any,
            contact: {
              fullName: "John Smith",
              email: "john.smith@example.com",
              phone: "0400333444",
              fulfilment: "pickup",
              company: "",
              deliveryAddress: "456 Oak Rd",
              deliverySuburb: "",
              notes: ""
            },
            notes: "",
            status: "accepted",
            created_at: "2026-06-30T10:00:00.000Z",
            updated_at: "2026-06-30T10:00:00.000Z"
          }
        ];
        localStorage.setItem('qsbom-quotes', JSON.stringify(localQuotes));
      }

      // 2. Fetch from Supabase
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            *,
            quote_runs (
              id,
              quote_run_segments ( id, segment_kind, segment_type )
            )
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const rows = (data ?? []) as (SavedQuote & { quote_runs?: QuoteDbRun[] })[];

        // Sync to localStorage
        const mergedQuotes = [...rows];
        for (const lq of localQuotes) {
          if (!mergedQuotes.some(mq => mq.id === lq.id)) {
            mergedQuotes.push(lq);
          }
        }
        localStorage.setItem('qsbom-quotes', JSON.stringify(mergedQuotes));

        const userIds = [...new Set(mergedQuotes.map((q) => q.user_id))];
        const profileMap = new Map<string, string | null>();
        if (userIds.length > 0) {
          try {
            const { data: profiles, error: profileError } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds);
            if (!profileError && profiles) {
              for (const profile of profiles) {
                profileMap.set(
                  profile.id,
                  formatCreatorLabel(profile.full_name, profile.email),
                );
              }
            }
          } catch (pe) {
            // ignore
          }
        }

        return mergedQuotes.map((quote) => toQuoteListItem(quote, profileMap));
      } catch (dbErr) {
        console.warn('Supabase fetch failed, falling back to localStorage quotes:', dbErr);
        const profileMap = new Map<string, string | null>();
        return localQuotes.map((quote) => toQuoteListItem(quote, profileMap));
      }
    },
  });

  const saveQuote = useMutation({
    mutationFn: async (quote: NewQuote) => {
      let savedData: SavedQuote | null = null;
      try {
        const { data, error } = await supabase
          .from('quotes')
          .insert(quote)
          .select()
          .single();
        if (error) throw error;
        savedData = data as SavedQuote;
      } catch (err) {
        console.warn('Supabase save failed, saving to localStorage fallback:', err);
        savedData = {
          ...quote,
          id: (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID()
            : Math.random().toString(36).substring(2),
          quote_number: Math.floor(Math.random() * 9000) + 1000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as SavedQuote;
      }

      // Write to localStorage
      const localStr = localStorage.getItem('qsbom-quotes');
      let localQuotes: SavedQuote[] = [];
      if (localStr) {
        try {
          localQuotes = JSON.parse(localStr);
        } catch (e) {}
      }
      localQuotes.unshift(savedData);
      localStorage.setItem('qsbom-quotes', JSON.stringify(localQuotes));

      return savedData;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const updateQuote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SavedQuote> }) => {
      let updatedData: SavedQuote | null = null;
      try {
        const { data, error } = await supabase
          .from('quotes')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        updatedData = data as SavedQuote;
      } catch (err) {
        console.warn('Supabase update failed, updating in localStorage fallback:', err);
      }

      // Write to localStorage
      const localStr = localStorage.getItem('qsbom-quotes');
      let localQuotes: SavedQuote[] = [];
      if (localStr) {
        try {
          localQuotes = JSON.parse(localStr);
        } catch (e) {}
      }

      const idx = localQuotes.findIndex((q) => q.id === id);
      if (idx !== -1) {
        if (updatedData) {
          localQuotes[idx] = updatedData;
        } else {
          localQuotes[idx] = {
            ...localQuotes[idx],
            ...updates,
            updated_at: new Date().toISOString(),
          } as SavedQuote;
          updatedData = localQuotes[idx];
        }
      } else if (!updatedData) {
        updatedData = {
          id,
          ...updates,
          updated_at: new Date().toISOString(),
        } as any;
      }
      localStorage.setItem('qsbom-quotes', JSON.stringify(localQuotes));

      return updatedData!;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase delete failed, deleting in localStorage fallback:', err);
      }

      // Write to localStorage
      const localStr = localStorage.getItem('qsbom-quotes');
      let localQuotes: SavedQuote[] = [];
      if (localStr) {
        try {
          localQuotes = JSON.parse(localStr);
        } catch (e) {}
      }
      localQuotes = localQuotes.filter((q) => q.id !== id);
      localStorage.setItem('qsbom-quotes', JSON.stringify(localQuotes));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  return { quotesQuery, saveQuote, updateQuote, deleteQuote };
}
