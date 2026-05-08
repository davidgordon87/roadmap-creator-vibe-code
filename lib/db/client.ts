/**
 * Neon serverless database client.
 *
 * Use only in Server Components, Server Actions, API routes, and
 * Netlify Functions. Never import in client ("use client") components.
 *
 * Lazy-initialised so missing env vars surface at runtime, not build time.
 */
import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Add it to .env.local (dev) or Netlify environment variables (prod)."
    );
  }

  _sql = neon(url);
  return _sql;
}
