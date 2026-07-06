// seed-library.js
//
// Upserts supabase/seeds/glass-outlet/quote-library.json (the Quotient price
// item library) into quote_library_items, keyed on (org_id, source_quote_item_id).
//
// Usage: node supabase/seeds/tools/seed-library.js  (or: npm run seed:library)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}`, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) throw new Error('Missing VITE_SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '..', 'glass-outlet', 'quote-library.json');

async function main() {
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  const { data: org, error: orgErr } = await supabase
    .from('organisations')
    .select('id')
    .eq('slug', raw.org_slug)
    .maybeSingle();
  if (orgErr || !org) throw new Error(`org lookup failed: ${orgErr?.message ?? 'not found'}`);

  const rows = raw.library_items.map((it) => ({ org_id: org.id, ...it }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('quote_library_items')
      .upsert(rows.slice(i, i + 200), {
        onConflict: 'org_id,source_quote_item_id',
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`library upsert: ${error.message}`);
  }
  console.log(`quote_library_items: ${rows.length} upserted`);
}

main().catch((e) => {
  console.error('SEED LIBRARY FAILED:', e.message);
  process.exit(1);
});
