/**
 * Browser-safe Supabase client — uses the anon (public) key.
 *
 * The anon key is subject to Row Level Security policies.
 * Safe to use in client components. Does NOT bypass RLS.
 * Reserved for future real-time subscriptions if needed.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

export const supabaseClient = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);
