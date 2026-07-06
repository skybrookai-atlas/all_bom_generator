import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

/**
 * instant-quote — PUBLIC endpoint for the embeddable website calculator.
 *
 * Identified by embed token (quote_settings.embed_token), no auth. Two actions:
 *
 * 1. { action: "config", token }
 *    → { companyName?, systems: [{ systemType, label, heights, options }] }
 *      (only systems with enabled=true AND rates configured)
 *
 * 2. { action: "price", token, systemType, lengthM, heightMm, variables? }
 *    → { rangeLowIncGst, rangeHighIncGst }        ← NEVER exact, NEVER costs
 *
 * 3. { action: "lead", token, systemType, lengthM, heightMm, variables?,
 *      contact: { name, email, phone, address? }, drawing? }
 *    → creates a draft quote + costed line item in the owner's pipeline
 *    → { ok: true }                               ← price still not revealed;
 *      the owner reviews and sends the formal quote
 *
 * All cost maths happens server-side via the bom-calculator internal path.
 */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Whitelisted customer-selectable variables per system — everything else is
// forced to safe defaults server-side.
const SYSTEM_CONFIG: Record<
  string,
  {
    label: string;
    heights: number[];
    options: Array<{ name: string; label: string; values: Array<{ value: string; label: string }> }>;
    defaults: Record<string, string | number | boolean>;
  }
> = {
  TP_PALING: {
    label: 'Treated Pine Paling Fence',
    heights: [1200, 1500, 1800, 2100],
    options: [
      {
        name: 'paling_style',
        label: 'Style',
        values: [
          { value: 'butted', label: 'Standard (butted)' },
          { value: 'lapped', label: 'Lapped' },
          { value: 'lapped-capped', label: 'Lapped & capped' },
        ],
      },
    ],
    defaults: { supplier: 'generic', paling_width_mm: 100, post_size: '100x75', plinth: 'none' },
  },
  COLORBOND: {
    label: 'Colorbond Steel Fence',
    heights: [1200, 1500, 1800, 2100],
    options: [
      {
        name: 'colour_code',
        label: 'Colour',
        values: [
          { value: 'MO', label: 'Monument' },
          { value: 'BA', label: 'Basalt' },
          { value: 'WG', label: 'Woodland Grey' },
          { value: 'SM', label: 'Surfmist' },
          { value: 'PB', label: 'Paperbark' },
          { value: 'DU', label: 'Dune' },
          { value: 'IS', label: 'Ironstone' },
          { value: 'SG', label: 'Shale Grey' },
        ],
      },
    ],
    // Amazing Fencing: per-piece prices verified against their own exports.
    // (Glass Outlet's colorbond catalogue prices are a suspected import
    // artifact — do not quote the public off them.)
    defaults: { supplier: 'amazing-fencing', profile_code: 'GZAG', post_cap_type: 'double' },
  },
};

function buildPayload(
  systemType: string,
  lengthM: number,
  heightMm: number,
  customerVars: Record<string, string>,
) {
  const cfg = SYSTEM_CONFIG[systemType];
  const vars: Record<string, string | number | boolean> = { ...cfg.defaults };
  for (const opt of cfg.options) {
    const v = customerVars?.[opt.name];
    if (v && opt.values.some((x) => x.value === v)) vars[opt.name] = v;
  }
  if (systemType === 'COLORBOND') {
    vars['post_colour_code'] = (vars['colour_code'] as string) ?? 'MO';
  }
  return {
    productCode: systemType,
    schemaVersion: 'v1',
    variables: vars,
    runs: [
      {
        runId: crypto.randomUUID(),
        productCode: systemType,
        segments: [
          {
            segmentId: crypto.randomUUID(),
            sortOrder: 0,
            kind: 'fence',
            productCode: systemType,
            confirmed: true,
            leftTermination: { kind: 'system' },
            rightTermination: { kind: 'system' },
            segmentWidthMm: Math.round(lengthM * 1000),
            targetHeightMm: heightMm,
          },
        ],
      },
    ],
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const action: string = body.action ?? 'price';
    const token: string = (body.token ?? '').trim();
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) throw new Error('Invalid widget token');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings } = await supabaseAdmin
      .from('quote_settings')
      .select('org_id, logo_url, primary_color')
      .eq('embed_token', token)
      .maybeSingle();
    if (!settings) throw new Error('Unknown widget token');
    const orgId = settings.org_id as string;

    const { data: iqRows } = await supabaseAdmin
      .from('instant_quote_settings')
      .select('system_type, enabled, labor_per_m, margin_pct, range_spread_pct, min_job')
      .eq('org_id', orgId);
    const active = (iqRows ?? []).filter(
      (r) => r.enabled && r.labor_per_m != null && SYSTEM_CONFIG[r.system_type],
    );

    if (action === 'config') {
      const { data: org } = await supabaseAdmin
        .from('organisations')
        .select('name')
        .eq('id', orgId)
        .single();
      return Response.json(
        {
          companyName: org?.name ?? '',
          logoUrl: settings.logo_url,
          primaryColor: settings.primary_color,
          systems: active.map((r) => ({
            systemType: r.system_type,
            label: SYSTEM_CONFIG[r.system_type].label,
            heights: SYSTEM_CONFIG[r.system_type].heights,
            options: SYSTEM_CONFIG[r.system_type].options,
          })),
        },
        { headers: corsHeaders },
      );
    }

    // ── price / lead: validate inputs ────────────────────────────────────────
    const systemType: string = body.systemType;
    const iq = active.find((r) => r.system_type === systemType);
    if (!iq) throw new Error('This fence type is not available for instant quotes');

    const lengthM = clamp(Number(body.lengthM) || 0, 1, 500);
    const cfg = SYSTEM_CONFIG[systemType];
    const heightMm = cfg.heights.includes(Number(body.heightMm))
      ? Number(body.heightMm)
      : 1800;
    if (lengthM < 1) throw new Error('Fence length must be at least 1 metre');

    // ── run the engine server-side (internal trusted call) ──────────────────
    const payload = buildPayload(systemType, lengthM, heightMm, body.variables ?? {});
    const engineRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/bom-calculator`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload, internalOrgId: orgId }),
      },
    );
    const engine = await engineRes.json();
    if (!engineRes.ok || engine.error) {
      throw new Error('Could not calculate this fence — please try different options');
    }

    const materialsExGst: number = engine.totals?.subtotal ?? 0;
    if (materialsExGst <= 0) throw new Error('Could not price this configuration');

    const labourExGst = Number(iq.labor_per_m) * lengthM;
    const marginPct = Number(iq.margin_pct ?? 30);
    let exactExGst = (materialsExGst + labourExGst) * (1 + marginPct / 100);
    exactExGst = Math.max(exactExGst, Number(iq.min_job ?? 0));
    const exactIncGst = exactExGst * 1.1;

    const spread = Number(iq.range_spread_pct ?? 8) / 100;
    // Round the public range to $50 so the exact figure can't be reverse-read.
    const roundTo = (n: number, step: number) => Math.round(n / step) * step;
    const rangeLowIncGst = roundTo(exactIncGst * (1 - spread), 50);
    const rangeHighIncGst = roundTo(exactIncGst * (1 + spread), 50);

    if (action === 'price') {
      return Response.json({ rangeLowIncGst, rangeHighIncGst }, { headers: corsHeaders });
    }

    if (action === 'lead') {
      const contact = body.contact ?? {};
      const name = String(contact.name ?? '').trim().slice(0, 120);
      const email = String(contact.email ?? '').trim().slice(0, 200);
      const phone = String(contact.phone ?? '').trim().slice(0, 40);
      const address = String(contact.address ?? '').trim().slice(0, 300);
      if (!name || (!email && !phone)) {
        throw new Error('Please provide your name and an email or phone number');
      }

      // Assign the lead to the org's admin (first one found) so it shows in
      // "their" quote list; user_id stays null if the org has no admin yet.
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      const optionSummary = cfg.options
        .map((o) => {
          const v = (body.variables ?? {})[o.name];
          const val = o.values.find((x) => x.value === v);
          return val ? `${o.label}: ${val.label}` : null;
        })
        .filter(Boolean)
        .join(', ');

      const { data: quote, error: qErr } = await supabaseAdmin
        .from('quotes')
        .insert({
          org_id: orgId,
          user_id: adminProfile?.id ?? null,
          fence_config: {},
          bom: {},
          contact: { fullName: name, email, phone, deliveryAddress: address },
          notes: `Website instant-quote lead (${new Date().toISOString().slice(0, 10)})`,
          status: 'draft',
          title: `Website lead — ${cfg.label}, ${lengthM}m × ${heightMm}mm — ${name}`,
        })
        .select('id')
        .single();
      if (qErr) throw new Error(`Could not save your request: ${qErr.message}`);

      const unitPriceExGst = Math.round((exactExGst / lengthM) * 100) / 100;
      const { error: liErr } = await supabaseAdmin.from('quote_line_items').insert({
        org_id: orgId,
        quote_id: quote.id,
        sort_order: 1,
        kind: 'calculated',
        title: `${cfg.label} — supply & install, ${heightMm}mm high`,
        description: `${lengthM}m × ${heightMm}mm${optionSummary ? ` — ${optionSummary}` : ''}\nGenerated by the website instant-quote calculator.`,
        quantity: lengthM,
        unit: 'm',
        unit_price: unitPriceExGst,
        material_cost: Math.round(materialsExGst * 100) / 100,
        labor_cost: Math.round(labourExGst * 100) / 100,
        markup_pct: marginPct,
        bom_snapshot: { engineTotals: engine.totals, lines: engine.lines ?? [] },
        metadata: {
          source: 'instant-quote-widget',
          drawing: body.drawing ?? null,
          shownRange: [rangeLowIncGst, rangeHighIncGst],
        },
      });
      if (liErr) throw new Error(`Could not save your request: ${liErr.message}`);

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    throw new Error('Unknown action');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Something went wrong';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
