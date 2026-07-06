// import-quotient-library.mjs
//
// One-shot: reads the Quotient Replica's data/items.json (the owner's real
// Quotient price item library) and writes the committed seed
// supabase/seeds/glass-outlet/quote-library.json. Load with:
//   npm run seed:library
//
// Usage: node scripts/import-quotient-library.mjs [path-to-items.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = resolve(
  __dirname, '..', '..', 'Quotient Replica', 'data', 'items.json',
);
const OUT_FILE = resolve(
  __dirname, '..', 'supabase', 'seeds', 'glass-outlet', 'quote-library.json',
);

const sourcePath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SOURCE;
const raw = JSON.parse(readFileSync(sourcePath, 'utf8'));
const items = Array.isArray(raw) ? raw : raw.items ?? [];

const out = {
  org_slug: 'glass-outlet',
  generated_from: sourcePath,
  library_items: items
    .filter((it) => it.item_title)
    .map((it, idx) => ({
      title: String(it.item_title).trim(),
      body: String(it.item_body ?? '').trim(),
      unit: 'each',
      unit_price: Number(it.price_unit ?? 0) || 0,
      categories: Array.isArray(it.categories) ? it.categories : [],
      sort_order: idx,
      active: true,
      source_quote_item_id: it.quote_item_id ?? null,
      metadata: {
        source: 'quotient-library-import',
        images: (it.images ?? []).map((img) => img.localPath ?? img.filename ?? null).filter(Boolean),
      },
    })),
};

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.library_items.length} library items → ${OUT_FILE}`);
