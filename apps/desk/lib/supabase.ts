// Supabase client wrapper. Returns null when env vars are absent so the data
// layer can fall back to in-memory fixtures (zero external setup to run).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  cached = url && key ? createClient(url, key) : null;
  return cached;
}

/** True when a live Supabase project is configured; false => use fixtures. */
export function isLive(): boolean {
  return getSupabase() !== null;
}
