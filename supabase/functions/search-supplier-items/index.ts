import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { extractJwt, resolveUserProfile } from '../_shared/auth.ts';

/**
 * search-supplier-items
 *
 * Staff-only search over the supplier price-list catalogue (supplier_items —
 * service-role only, cost prices included). Used by the quote editor's
 * "Add catalogue item" typeahead.
 *
 * POST /functions/v1/search-supplier-items
 * Body: { query: string, supplierSlug?: string, limit?: number }
 * Returns: { items: Array<{ id, sku, description, category, system, colour,
 *            material, unit, price, supplier_name, supplier_slug }> }
 */
Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const jwt = extractJwt(req);
    const { orgId } = await resolveUserProfile(jwt);

    const body = await req.json();
    const query: string = (body.query ?? '').trim();
    const supplierSlug: string = (body.supplierSlug ?? '').trim();
    const limit: number = Math.min(Number(body.limit ?? 15), 30);

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const pattern = `%${query}%`;

    let q = supabaseAdmin
      .from('supplier_items')
      .select('id, sku, description, category, system, colour, material, unit, price, suppliers!inner(name, slug)')
      .eq('org_id', orgId)
      .eq('active', true)
      .or(`sku.ilike.${pattern},description.ilike.${pattern}`)
      .order('description', { ascending: true })
      .limit(limit);

    if (supplierSlug) q = q.eq('suppliers.slug', supplierSlug);

    const { data, error } = await q;
    if (error) throw new Error(`Supplier item search failed: ${error.message}`);

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
        supplier_name: supplier?.name ?? '',
        supplier_slug: supplier?.slug ?? '',
      };
    });

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
