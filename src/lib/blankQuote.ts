import { supabase } from "./supabase";

/**
 * Quotient-style blank quote: insert a draft quotes row and return its id so
 * the caller can navigate straight to /quote/<id>/edit.
 *
 * Resolves the session + org at call-time rather than depending on the
 * ProfileContext having already resolved (avoids a first-load race where
 * orgId is briefly null). Callers may pass hints from context to skip the
 * lookups when they're already known.
 */
export async function createBlankQuote(hints?: {
  userId?: string | null;
  orgId?: string | null;
}): Promise<string> {
  let userId = hints?.userId ?? null;
  let orgId = hints?.orgId ?? null;

  if (!userId || !orgId) {
    const { data: sessionData } = await supabase.auth.getUser();
    userId = userId ?? sessionData.user?.id ?? null;
    if (userId && !orgId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", userId)
        .single();
      orgId = prof?.org_id ?? null;
    }
  }
  if (!userId || !orgId) {
    throw new Error("Please sign in again — your session could not be read.");
  }

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      org_id: orgId,
      user_id: userId,
      fence_config: {},
      bom: {},
      contact: {},
      notes: "",
      status: "draft",
      title: "Untitled quote",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
