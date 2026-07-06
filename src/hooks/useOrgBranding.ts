import { useQuery } from '@tanstack/react-query';

import { useAuth } from './useAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mergeBrand, type BrandInfo } from '../lib/brand';
import type { TenantTheme } from '../lib/tenantThemes';

type OrgBrandingRow = {
  name: string | null;
  branding: TenantTheme | null;
};

/**
 * Org-driven branding for authenticated pages.
 *
 * Selects `name` + `branding` from the user's own organisations row (RLS
 * restricts the query to `id = user_org_id()`), and merges the branding JSONB
 * over DEFAULT_BRAND — so this always returns a fully-populated BrandInfo,
 * even while loading, in preview mode, or if the org has no branding set.
 *
 * Do NOT use this on the anonymous quote portal — anon users cannot read the
 * organisations table. The portal uses quote_settings.logo_url + DEFAULT_BRAND.
 */
export function useOrgBranding(): BrandInfo {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['org-branding', user?.id],
    enabled: !!user && isSupabaseConfigured,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<OrgBrandingRow | null> => {
      const { data, error } = await supabase
        .from('organisations')
        .select('name, branding')
        .limit(1);
      if (error) throw error;
      return (data?.[0] as OrgBrandingRow | undefined) ?? null;
    },
  });

  return mergeBrand(data?.name, data?.branding?.branding);
}
