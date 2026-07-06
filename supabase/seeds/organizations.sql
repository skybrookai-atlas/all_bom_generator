-- Seed the first org with full theme config in branding JSONB
-- NOTE: the slug 'glass-outlet' is a legacy internal key referenced by every
-- seed file — display identity lives in name/branding, not the slug.
INSERT INTO organisations (name, slug, branding)
VALUES (
  'Byron & Beyond Fencing',
  'glass-outlet',
  '{"cssVars":{"--brand-bg":"#eef1f5","--brand-card":"#ffffff","--brand-border":"#c3cdd9","--brand-accent":"30 90 143","--brand-accent-hover":"#174a77","--brand-muted":"#5b6b7c","--brand-text":"#132a40","--brand-header-bg":"#12395e","--brand-header-text":"#ffffff","--brand-radius":"0.375rem","--brand-radius-sm":"0.25rem"},"branding":{"title":"BYRON & BEYOND","titleItalic":"fencing","subtitle":"Quotes, fence calculators & supplier pricing","hideThemeToggle":false,"companyName":"Byron & Beyond Fencing","tagline":"Licensed Fencing Specialists","website":"www.byronandbeyondfencing.com.au","logoUrl":"/brand/byron-beyond-logo.png"}}'
)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, branding = EXCLUDED.branding;
