// import-replica-supplier-items.mjs
//
// One-shot converter: reads the Quotient Replica's data/supplier_items.json
// (compiled from supplier price lists + Xero bills) and writes the committed
// seed file supabase/seeds/glass-outlet/supplier-catalogue.json.
//
// Re-run whenever the replica catalogue is refreshed:
//   node scripts/import-replica-supplier-items.mjs [path-to-supplier_items.json]
// Then load into the DB with: npm run seed:suppliers

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = resolve(
  __dirname,
  '..',
  '..',
  'Quotient Replica',
  'data',
  'supplier_items.json',
);
const OUT_FILE = resolve(
  __dirname,
  '..',
  'supabase',
  'seeds',
  'glass-outlet',
  'supplier-catalogue.json',
);

const sourcePath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SOURCE;

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const items = JSON.parse(readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(items)) throw new Error('Expected an array of supplier items');

const suppliers = new Map();
const outItems = [];
const seenKeys = new Set();

for (const it of items) {
  if (!it.supplier || !it.description || typeof it.price !== 'number') {
    console.warn('Skipping malformed row:', JSON.stringify(it).slice(0, 120));
    continue;
  }
  const slug = slugify(it.supplier);
  if (!suppliers.has(slug)) suppliers.set(slug, { name: it.supplier, slug, active: true });

  // Stable natural key so re-imports upsert instead of duplicating.
  let sourceKey = `${slug}|${it.code || it.description}`;
  // Guard against collisions when code is empty and descriptions repeat.
  let n = 2;
  while (seenKeys.has(sourceKey)) sourceKey = `${slug}|${it.code || it.description}|${n++}`;
  seenKeys.add(sourceKey);

  outItems.push({
    supplier_slug: slug,
    sku: it.code || null,
    description: it.description,
    category: it.category || null,
    system: it.system || null,
    colour: it.color || null,
    material: it.material || null,
    unit: 'each',
    price: it.price,
    source: 'quotient-replica-import',
    source_key: sourceKey,
    imported_date: it.importedDate || null,
    active: true,
  });
}

const out = {
  org_slug: 'glass-outlet',
  generated_from: sourcePath,
  suppliers: [...suppliers.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  supplier_items: outItems,
};

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(
  `Wrote ${out.suppliers.length} suppliers, ${outItems.length} items → ${OUT_FILE}`,
);
