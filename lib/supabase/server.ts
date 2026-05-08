/**
 * Server-side Supabase client — uses the service role key.
 *
 * The service role key bypasses Row Level Security entirely.
 * NEVER import this module in client components or expose it to the browser.
 * Use only in Server Components, Server Actions, and API routes.
 *
 * Lazy-initialised: the client is created on first call, not at import time,
 * so missing env vars surface as runtime errors rather than build failures.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _client: SupabaseClient<Database> | null = null;

export function getSupabaseServer(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add them to .env.local (dev) or Netlify environment variables (prod)."
    );
  }

  _client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}
