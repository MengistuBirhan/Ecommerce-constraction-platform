import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** False when the Vercel/.env variables were not set at BUILD time. */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Do NOT throw here: a throw at import time kills the whole app and leaves a blank page.
  console.error(
    'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (then redeploy).',
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  { auth: { persistSession: false } },
);
