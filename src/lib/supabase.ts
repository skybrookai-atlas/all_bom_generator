import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const PREVIEW_MODE_STORAGE_KEY = 'qsbom-preview-without-backend';

function readPreviewMode() {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(PREVIEW_MODE_STORAGE_KEY) === 'true'
  );
}

export const isPreviewMode = readPreviewMode();
export const isSupabaseConfigured = !isPreviewMode && Boolean(supabaseUrl && supabaseAnonKey);

export function enablePreviewMode() {
  window.localStorage.setItem(PREVIEW_MODE_STORAGE_KEY, 'true');
}

export function disablePreviewMode() {
  window.localStorage.removeItem(PREVIEW_MODE_STORAGE_KEY);
}

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'local-dev-anon-key',
);
