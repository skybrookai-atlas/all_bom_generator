// import-xero-bills.mjs
//
// Parses cleaned Xero bill-export CSVs (one per supplier) and MERGES the line
// items into supabase/seeds/glass-outlet/supplier-catalogue.json:
//   - new suppliers are added (slug derived from the file name)
//   - items are keyed by source_key = `${slug}|${code || description}`
//   - when the same item appears on multiple invoices, the LATEST InvoiceDate
//     wins (current cost), with purchase history counts kept in metadata
//   - delivery / freight / surcharge / note rows are skipped
//
// Usage: node scripts/import-xero-bills.mjs "<folder-with-csvs>"
// Then:  npm run seed:suppliers

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOGUE_FILE = resolve(
  __dirname, '..', 'supabase', 'seeds', 'glass-outlet', 'supplier-catalogue.json',
);

const folder = process.argv[2];
if (!folder) throw new Error('Usage: node scripts/import-xero-bills.mjs <folder>');

const slugify = (name) =>
  name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Minimal CSV parser handling quoted fields with commas.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const parseAuDate = (s) => {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(0);
};

const SKIP_DESC = /deliver|freight|surcharge|apolog|^credit|account fee|card fee/i;

const guessCategory = (d) => {
  const t = d.toLowerCase();
  if (/post/.test(t)) return 'Posts';
  if (/paling/.test(t)) return 'Palings';
  if (/rail|75x38|75 x 38|100x38/.test(t)) return 'Rails';
  if (/sleeper|slab/.test(t)) return 'Sleepers';
  if (/nail|screw|bolt|fixing|anchor/.test(t)) return 'Fixings';
  if (/concrete|cement|rapid ?set|post ?mix/.test(t)) return 'Concrete';
  if (/sheet|infill|panel/.test(t)) return 'Panels and Cladding';
  if (/cap/.test(t)) return 'Caps';
  if (/gate/.test(t)) return 'Gates';
  return null;
};

const guessMaterial = (d) => {
  const t = d.toLowerCase();
  if (/t\/pine|treated pine|h3|h4|pine/.test(t)) return 'Treated Pine';
  if (/hardwood|merbau|spotted gum|ironbark/.test(t)) return 'Hardwood';
  if (/colorbond|colourbond|steel|gal/.test(t)) return 'Steel';
  if (/alumini?um/.test(t)) return 'Aluminium';
  if (/concrete|cement/.test(t)) return 'Concrete';
  return null;
};

const catalogue = JSON.parse(readFileSync(CATALOGUE_FILE, 'utf8'));
const suppliersBySlug = new Map(catalogue.suppliers.map((s) => [s.slug, s]));
// Re-imports regenerate every xero-sourced item, so drop the old ones first
// (their keys may have changed).
catalogue.supplier_items = catalogue.supplier_items.filter(
  (it) => it.source !== 'xero-bills-import',
);
const itemsByKey = new Map(catalogue.supplier_items.map((it) => [it.source_key, it]));

// best[key] = { item, date, seen } during this import
const best = new Map();
let skipped = 0, lines = 0;

for (const file of readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.csv'))) {
  const supplierName = basename(file, '.csv').replace(/\s*\(\d+\)$/, '').trim();
  const slug = slugify(supplierName);
  if (!suppliersBySlug.has(slug)) {
    const row = { name: supplierName, slug, active: true, metadata: { source: 'xero-bills-import' } };
    suppliersBySlug.set(slug, row);
    catalogue.suppliers.push(row);
  }

  const rows = parseCsv(readFileSync(join(folder, file), 'utf8'));
  const header = rows[0];
  const col = (name) => header.indexOf(name);
  const iDesc = col('Description'), iQty = col('Quantity'), iUnit = col('UnitAmount'),
    iCode = col('InventoryItemCode'), iDate = col('InvoiceDate'), iType = col('Type'),
    iAccount = col('AccountCode');

  for (const r of rows.slice(1)) {
    if (r.length < header.length - 2) continue;
    lines++;
    const desc = (r[iDesc] ?? '').trim();
    const qty = parseFloat(r[iQty] ?? '0');
    const unit = parseFloat(r[iUnit] ?? '0');
    const type = (r[iType] ?? '').trim();
    const account = (r[iAccount] ?? '').trim();
    if (type && type !== 'Bill') { skipped++; continue; }
    if (!desc || !(qty > 0) || !(unit > 0)) { skipped++; continue; }
    if (SKIP_DESC.test(desc) || account === '312') { skipped++; continue; }

    const code = (r[iCode] ?? '').trim() || null;
    const date = parseAuDate(r[iDate]);
    // Xero item codes are per product family, not per size ("8FPO 100X075"
    // covers 1.8m AND 2.1m posts) — the description carries the size, so it
    // must be part of the identity.
    const key = `${slug}|${code ?? ''}|${desc.toLowerCase().replace(/\s+/g, ' ')}`;
    const prev = best.get(key);
    if (prev) {
      prev.seen++;
      if (date > prev.date) { prev.date = date; prev.unit = unit; prev.desc = desc; prev.code = code; }
    } else {
      best.set(key, { slug, key, desc, code, unit, date, seen: 1 });
    }
  }
}

let added = 0, updated = 0;
for (const b of best.values()) {
  const item = {
    supplier_slug: b.slug,
    sku: b.code,
    description: b.desc,
    category: guessCategory(b.desc),
    system: null,
    colour: null,
    material: guessMaterial(b.desc),
    unit: 'each',
    price: Math.round(b.unit * 100) / 100,
    source: 'xero-bills-import',
    source_key: b.key,
    imported_date: new Date().toISOString(),
    active: true,
    metadata: {
      last_invoice_date: b.date.toISOString().slice(0, 10),
      times_purchased: b.seen,
    },
  };
  if (itemsByKey.has(b.key)) {
    const idx = catalogue.supplier_items.findIndex((it) => it.source_key === b.key);
    catalogue.supplier_items[idx] = item;
    updated++;
  } else {
    catalogue.supplier_items.push(item);
    added++;
  }
}

catalogue.suppliers.sort((a, z) => a.slug.localeCompare(z.slug));
writeFileSync(CATALOGUE_FILE, JSON.stringify(catalogue, null, 2));
console.log(`lines read: ${lines}, skipped (delivery/notes/zero): ${skipped}`);
console.log(`items added: ${added}, updated: ${updated}, suppliers total: ${catalogue.suppliers.length}`);
const bySup = {};
for (const b of best.values()) bySup[b.slug] = (bySup[b.slug] || 0) + 1;
console.log(JSON.stringify(bySup, null, 1));
