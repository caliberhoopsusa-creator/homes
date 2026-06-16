// Supabase client wrapper. The desk is entirely server-rendered, so the data
// client prefers the SERVICE-ROLE key (server-only; bypasses the RLS policies
// which grant the service/authenticated role). Falls back to the anon key
// (e.g. client-side realtime), then to null → the data layer uses fixtures.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service-role is a non-public var → never shipped to the browser. Anon is the
  // public fallback used by client-side realtime.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  cached =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return cached;
}

/** True when a live Supabase project is configured; false => use fixtures. */
export function isLive(): boolean {
  return getSupabase() !== null;
}
