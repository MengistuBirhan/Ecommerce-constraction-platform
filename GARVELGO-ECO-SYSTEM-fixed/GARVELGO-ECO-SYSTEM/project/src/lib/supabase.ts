import { createClient } from '@supabase/supabase-js';

// Public values (safe in the browser). Used when Vercel env vars are missing or invalid.
const FALLBACK_URL = 'https://uoanfgjrkltpyrhtcnnm.supabase.co';
const FALLBACK_KEY = 'sb_publishable_RBtZmH7igCIj71EERA87bA_AwoaCuPt';

function clean(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/^['"`]+|['"`]+$/g, '').trim() : '';
}

function validUrl(raw: unknown): string {
  let v = clean(raw);
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : '';
  } catch {
    return '';
  }
}

const url = validUrl(import.meta.env.VITE_SUPABASE_URL) || FALLBACK_URL;
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY) || FALLBACK_KEY;

export const supabaseConfigured = true;
export const supabaseConfigProblem: string | null = null;

export const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
