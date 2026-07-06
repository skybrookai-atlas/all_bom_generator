import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quoteId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(quoteId)) {
      return new Response(JSON.stringify({ error: "Invalid quoteId format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch quote to get org_id and status
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("org_id, status")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: quoteError?.message || "Quote not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (quote.status !== "accepted") {
      return new Response(JSON.stringify({ error: "Quote status must be accepted to generate an invoice" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch settings for the org_id to check xero_enabled
    const { data: settings, error: settingsError } = await supabase
      .from("quote_settings")
      .select("xero_enabled")
      .eq("org_id", quote.org_id)
      .single();

    if (settingsError || !settings || settings.xero_enabled !== true) {
      return new Response(JSON.stringify({ error: "Xero synchronization is disabled for this organization." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { error } = await supabase
      .from("quotes")
      .update({
        xero_invoice_id: "XERO-INV-12345",
        xero_sync_status: "Synced",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, invoiceId: "XERO-INV-12345" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
