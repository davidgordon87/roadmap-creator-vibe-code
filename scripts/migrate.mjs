/**
 * One-shot migration runner for Neon.
 * Usage: node scripts/migrate.mjs
 * Requires DATABASE_URL in .env.local or environment.
 */
import { readFileSync } from "fs";
import { Pool } from "@neondatabase/serverless";

// Load .env.local manually
const envFile = readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envFile
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const databaseUrl = envVars.DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

const migration = readFileSync(
  "supabase/migrations/20260508165906_initial_schema.sql",
  "utf8"
);

try {
  await client.query("BEGIN");
  await client.query(migration);
  await client.query("COMMIT");
  console.log("✓ Migration applied successfully");
} catch (err) {
  await client.query("ROLLBACK");
  if (err.message?.includes("already exists")) {
    console.log("✓ Tables already exist — migration skipped (idempotent)");
  } else {
    console.error("✗ Migration failed:", err.message);
    process.exit(1);
  }
} finally {
  client.release();
  await pool.end();
}
