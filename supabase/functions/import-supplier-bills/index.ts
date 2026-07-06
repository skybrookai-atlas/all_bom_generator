import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { extractJwt, resolveUserProfile } from '../_shared/auth.ts';

/**
 * import-supplier-bills
 *
 * Accepts cleaned Xero bill-export CSVs (as text) and merges the line items
 * into the supplier_items catalogue:
 *   - suppliers are created on the fly (slug from the supplier name)
 *   - items keyed by source_key = `${slug}|${code}|${normalised description}`
 *     (Xero item codes are per product family, so the description carries size)
 *   - latest InvoiceDate wins, both within the upload AND against existing DB
 *     rows — re-uploading an old export can never regress a newer price
 *   - delivery / freight / surcharge / note / zero rows are skipped
 *
 * POST /functions/v1/import-supplier-bills
 * Body: { files: Array<{ name: string, csvText: string, supplierName?: string }> }
 * Returns: { results: Array<{ file, supplier, added, updated, skippedOlder, skippedLines }>, totals }
 */

const slugify = (name: string) =>
  name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const parseAuDate = (s: string): Date => {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(0);
};

const SKIP_DESC = /deliver|freight|surcharge|apolog|^credit|account fee|card fee/i;

const guessCategory = (d: string): string | null => {
  const t = d.toLowerCase();
  if (/post/.test(t)) return 'Posts';
  if (/paling/.test(t)) return 'Palings';
  if (/rail|75x38|75 x 38|100x38/.test(t)) return 'Rails';
  if (/sleeper|slab/.test(t)) return 'Sleepers';
  if (/nail|screw|bolt|fixing|anchor/.test(t)) return 'Fixings';
  if (/concrete|cement|rapid ?set|post ?mix/.test(t)) return 'Concrete';
  if (/sheet|infill|panel/.test(t)) return 'Panels and Cladding';
  if (/cap/.test(t)) return 'Caps';
  if (/gate/.test(t)) return 'Gates';
  return null;
};

const guessMaterial = (d: string): string | null => {
  const t = d.toLowerCase();
  if (/t\/pine|treated pine|h3|h4|pine/.test(t)) return 'Treated Pine';
  if (/hardwood|merbau|spotted gum|ironbark/.test(t)) return 'Hardwood';
  if (/colorbond|colourbond|steel|gal/.test(t)) return 'Steel';
  if (/alumini?um/.test(t)) return 'Aluminium';
  if (/concrete|cement/.test(t)) return 'Concrete';
  return null;
};

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const jwt = extractJwt(req);
    const { orgId } = await resolveUserProfile(jwt);

    const body = await req.json();
    const files: Array<{ name: string; csvText: string; supplierName?: string }> =
      body.files ?? [];
    if (!files.length) throw new Error('No files provided');
    if (files.length > 25) throw new Error('Too many files in one upload (max 25)');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const results: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const rows = parseCsv(file.csvText ?? '');
      if (rows.length < 2) {
        results.push({ file: file.name, error: 'Empty or unparseable CSV' });
        continue;
      }
      const header = rows[0];
      const col = (n: string) => header.indexOf(n);
      const iDesc = col('Description'), iQty = col('Quantity'), iUnit = col('UnitAmount'),
        iCode = col('InventoryItemCode'), iDate = col('InvoiceDate'), iType = col('Type'),
        iAccount = col('AccountCode'), iContact = col('ContactName');
      if (iDesc < 0 || iUnit < 0) {
        results.push({ file: file.name, error: 'Not a Xero bill export (missing Description/UnitAmount columns)' });
        continue;
      }

      // Supplier: explicit override > first ContactName > file name.
      const firstContact = rows.slice(1).map((r) => (r[iContact] ?? '').trim()).find(Boolean);
      const supplierName = (file.supplierName?.trim() ||
        firstContact ||
        file.name.replace(/\.csv$/i, '').replace(/\s*\(\d+\)$/, '')).trim();
      const slug = slugify(supplierName);

      const { error: supErr } = await supabaseAdmin
        .from('suppliers')
        .upsert(
          { org_id: orgId, name: supplierName, slug, active: true, metadata: { source: 'xero-bills-upload' } },
          { onConflict: 'org_id,slug', ignoreDuplicates: false },
        );
      if (supErr) throw new Error(`supplier upsert (${supplierName}): ${supErr.message}`);
      const { data: supplier } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .eq('org_id', orgId)
        .eq('slug', slug)
        .single();

      // latest-wins within the file
      const best = new Map<string, { desc: string; code: string | null; unit: number; date: Date; seen: number }>();
      let skippedLines = 0;
      for (const r of rows.slice(1)) {
        if (r.length < header.length - 2) continue;
        const desc = (r[iDesc] ?? '').trim();
        const qty = parseFloat(r[iQty] ?? '0');
        const unit = parseFloat(r[iUnit] ?? '0');
        const type = iType >= 0 ? (r[iType] ?? '').trim() : 'Bill';
        const account = iAccount >= 0 ? (r[iAccount] ?? '').trim() : '';
        if ((type && type !== 'Bill') || !desc || !(qty > 0) || !(unit > 0) ||
          SKIP_DESC.test(desc) || account === '312') {
          skippedLines++;
          continue;
        }
        const code = iCode >= 0 ? (r[iCode] ?? '').trim() || null : null;
        const date = iDate >= 0 ? parseAuDate(r[iDate]) : new Date(0);
        const key = `${slug}|${code ?? ''}|${desc.toLowerCase().replace(/\s+/g, ' ')}`;
        const prev = best.get(key);
        if (prev) {
          prev.seen++;
          if (date > prev.date) { prev.date = date; prev.unit = unit; prev.desc = desc; prev.code = code; }
        } else best.set(key, { desc, code, unit, date, seen: 1 });
      }

      // latest-wins against existing DB rows
      const keys = [...best.keys()];
      const existing = new Map<string, { id: string; last: string }>();
      for (let i = 0; i < keys.length; i += 200) {
        const { data } = await supabaseAdmin
          .from('supplier_items')
          .select('id, source_key, metadata')
          .eq('org_id', orgId)
          .in('source_key', keys.slice(i, i + 200));
        for (const row of data ?? []) {
          existing.set(row.source_key, {
            id: row.id,
            last: (row.metadata as Record<string, string>)?.last_invoice_date ?? '1970-01-01',
          });
        }
      }

      let added = 0, updated = 0, skippedOlder = 0;
      const toUpsert: Record<string, unknown>[] = [];
      for (const [key, b] of best) {
        const newDate = b.date.toISOString().slice(0, 10);
        const ex = existing.get(key);
        if (ex && ex.last > newDate) { skippedOlder++; continue; }
        toUpsert.push({
          org_id: orgId,
          supplier_id: supplier!.id,
          sku: b.code,
          description: b.desc,
          category: guessCategory(b.desc),
          material: guessMaterial(b.desc),
          unit: 'each',
          price: Math.round(b.unit * 100) / 100,
          source: 'xero-bills-import',
          source_key: key,
          imported_date: new Date().toISOString(),
          active: true,
          metadata: { last_invoice_date: newDate, times_purchased: b.seen },
        });
        if (ex) updated++; else added++;
      }
      for (let i = 0; i < toUpsert.length; i += 500) {
        const { error } = await supabaseAdmin
          .from('supplier_items')
          .upsert(toUpsert.slice(i, i + 500), { onConflict: 'org_id,source_key', ignoreDuplicates: false });
        if (error) throw new Error(`item upsert (${supplierName}): ${error.message}`);
      }

      results.push({ file: file.name, supplier: supplierName, added, updated, skippedOlder, skippedLines });
    }

    const totals = results.reduce(
      (acc: Record<string, number>, r) => {
        for (const k of ['added', 'updated', 'skippedOlder', 'skippedLines']) {
          acc[k] += Number(r[k] ?? 0);
        }
        return acc;
      },
      { added: 0, updated: 0, skippedOlder: 0, skippedLines: 0 },
    );

    return new Response(JSON.stringify({ results, totals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
