// Commerly — one-off migration runner.
// Usage:
//   node scripts/run-migrations.mjs            # runs the two migrations
//   node scripts/run-migrations.mjs --seed     # also runs supabase/seed.sql
//
// Connection string is read from env DATABASE_URL, or from a local .env line
// `DATABASE_URL=postgresql://...` (the .env file is gitignored and never committed).
//
// Get the string from Supabase → Project Settings → Database → Connection string
// (use the "Session"/direct connection, URI format, with your DB password).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(root, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

const files = [
  "supabase/migrations/20260711120000_initial_schema.sql",
  "supabase/migrations/20260711120100_rls_policies.sql",
];
if (process.argv.includes("--seed")) files.push("supabase/seed.sql");

const connectionString = loadDatabaseUrl();
if (!connectionString) {
  console.error(
    "\n[run-migrations] No DATABASE_URL found.\n" +
      "  Provide it via:  DATABASE_URL='postgresql://...' node scripts/run-migrations.mjs\n" +
      "  or add a line   DATABASE_URL=postgresql://...   to .env (gitignored).\n",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
});

try {
  await client.connect();
  console.log("[run-migrations] connected.");
  for (const rel of files) {
    const sql = readFileSync(join(root, rel), "utf8");
    process.stdout.write(`[run-migrations] applying ${rel} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("[run-migrations] all migrations applied successfully.");
} catch (err) {
  console.error("\n[run-migrations] FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
