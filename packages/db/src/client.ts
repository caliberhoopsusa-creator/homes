import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ambientEnv, type EnvLike } from "./env.js";

/** The Supabase client these stores run against (service role on the server). */
export type Db = SupabaseClient;

/**
 * Build a service-role client from env. Server-only — the service-role key must
 * never reach the browser. Throws if not configured (no secrets in source).
 */
export function createServiceClient(env: EnvLike = ambientEnv()): Db {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for @parcel/db.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
