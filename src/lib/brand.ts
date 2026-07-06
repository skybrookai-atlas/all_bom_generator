import type { TenantBranding } from './tenantThemes';

/**
 * Resolved app-level brand identity. Always fully populated — org data (when
 * available) is merged over DEFAULT_BRAND, so consumers never need null checks.
 */
export type BrandInfo = {
  companyName: string;
  tagline: string;
  website: string;
  logoUrl: string;
  title: string;
  titleItalic?: string;
  subtitle: string;
};

/**
 * Fallback branding used whenever org data hasn't loaded yet, on pre-auth
 * screens (login), and on the anonymous quote portal (which cannot read the
 * organisations table under RLS).
 */
export const DEFAULT_BRAND: BrandInfo = {
  companyName: 'Byron & Beyond Fencing',
  tagline: 'Licensed Fencing Specialists',
  website: 'www.byronandbeyondfencing.com.au',
  logoUrl: '/brand/byron-beyond-logo.png',
  title: 'BYRON & BEYOND',
  titleItalic: 'fencing',
  subtitle: 'Quotes, fence calculators & supplier pricing',
};

/**
 * Merge an organisation's name + branding JSONB over DEFAULT_BRAND.
 * Any field the org omits falls back to the default.
 */
export function mergeBrand(
  orgName?: string | null,
  branding?: Partial<TenantBranding> | null,
): BrandInfo {
  return {
    companyName: branding?.companyName ?? orgName ?? DEFAULT_BRAND.companyName,
    tagline: branding?.tagline ?? DEFAULT_BRAND.tagline,
    website: branding?.website ?? DEFAULT_BRAND.website,
    logoUrl: branding?.logoUrl ?? DEFAULT_BRAND.logoUrl,
    title: branding?.title ?? DEFAULT_BRAND.title,
    titleItalic: branding?.titleItalic ?? DEFAULT_BRAND.titleItalic,
    subtitle: branding?.subtitle ?? DEFAULT_BRAND.subtitle,
  };
}
