import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { extractJwt, resolveUserProfile } from '../_shared/auth.ts';

/**
 * search-supplier-items
 *
 * Staff-only search AND browse over the supplier price-list catalogue
 * (supplier_items — service-role only, cost prices included). Used by the
 * quote editor's "Add catalogue item" typeahead and the catalogue browser page.
 *
 * POST /functions/v1/search-supplier-items
 * Body: {
 *   query?: string,            // optional — empty = browse everything
 *   supplierSlug?: string,     // legacy single filter
 *   supplierSlugs?: string[],  // multi-supplier filter
 *   category?: string,
 *   sort?: 'description' | 'price' | 'price_desc' | 'supplier',
 *   offset?: number,
 *   limit?: number,            // browse allows up to 100
 * }
 * Returns: { items: [...], total, categories: string[] }
 */
Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const jwt = extractJwt(req);
    const { orgId } = await resolveUserProfile(jwt);

    const body = await req.json();
    const query: string = (body.query ?? '').trim();
    const supplierSlugs: string[] = Array.isArray(body.supplierSlugs)
      ? body.supplierSlugs.filter((s: unknown) => typeof s === 'string' && s)
      : body.supplierSlug
        ? [String(body.supplierSlug)]
        : [];
    const category: string = (body.category ?? '').trim();
    const sort: string = String(body.sort ?? 'description');
    const offset: number = Math.max(0, Number(body.offset ?? 0));
    const limit: number = Math.min(Math.max(1, Number(body.limit ?? 15)), 100);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = supabaseAdmin
      .from('supplier_items')
      .select(
        'id, sku, description, category, system, colour, material, unit, price, metadata, suppliers!inner(name, slug)',
        { count: 'exact' },
      )
      .eq('org_id', orgId)
      .eq('active', true);

    if (query.length >= 2) {
      const pattern = `%${query}%`;
      q = q.or(`sku.ilike.${pattern},description.ilike.${pattern}`);
    }
    if (supplierSlugs.length > 0) q = q.in('suppliers.slug', supplierSlugs);
    if (category) q = q.eq('category', category);

    if (sort === 'price') q = q.order('price', { ascending: true });
    else if (sort === 'price_desc') q = q.order('price', { ascending: false });
    else if (sort === 'supplier') q = q.order('supplier_id').order('description');
    else q = q.order('description', { ascending: true });

    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(`Supplier item search failed: ${error.message}`);

    // Distinct categories for the filter dropdown (cheap enough at this scale).
    const { data: catRows } = await supabaseAdmin
      .from('supplier_items')
      .select('category')
      .eq('org_id', orgId)
      .eq('active', true)
      .not('category', 'is', null)
      .limit(10000);
    const categories = [...new Set((catRows ?? []).map((r) => r.category).filter(Boolean))].sort();

    const items = (data ?? []).map((row) => {
      const supplier = row.suppliers as unknown as { name: string; slug: string };
      return {
        id: row.id,
        sku: row.sku,
        description: row.description,
        category: row.category,
        system: row.system,
        colour: row.colour,
        material: row.material,
        unit: row.unit,
        price: row.price,
        last_invoice_date:
          (row.metadata as Record<string, unknown>)?.last_invoice_date ?? null,
        supplier_name: supplier?.name ?? '',
        supplier_slug: supplier?.slug ?? '',
      };
    });

    return new Response(JSON.stringify({ items, total: count ?? items.length, categories }), {
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
