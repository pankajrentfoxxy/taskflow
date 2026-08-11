#!/usr/bin/env node
/**
 * Import a PostgreSQL SQL dump into the local taskflow database.
 * Usage: node scripts/import-db.mjs [path/to/dump.sql]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDump = path.resolve(
  process.env.HOME || process.env.USERPROFILE || "",
  "Downloads",
  "taskmanagementdunp.sql"
);

const dumpPath = path.resolve(process.argv[2] || defaultDump);

if (!fs.existsSync(dumpPath)) {
  console.error(`Dump file not found: ${dumpPath}`);
  console.error("Usage: node scripts/import-db.mjs [path/to/dump.sql]");
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "taskflow",
});

const sql = fs.readFileSync(dumpPath, "utf8");

console.log(`Importing ${dumpPath}`);
console.log(`Target: ${client.host}:${client.port}/${client.database}`);

await client.connect();
console.log("Dropping existing schema...");
await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
console.log("Running dump...");
await client.query(sql);

const counts = await client.query(`
  SELECT 'users' AS table_name, COUNT(*)::int AS rows FROM users
  UNION ALL SELECT 'projects', COUNT(*)::int FROM projects
  UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks
  UNION ALL SELECT 'teams', COUNT(*)::int FROM teams
  ORDER BY table_name
`);

console.log("Import complete. Row counts:");
for (const row of counts.rows) {
  console.log(`  ${row.table_name}: ${row.rows}`);
}

await client.end();
