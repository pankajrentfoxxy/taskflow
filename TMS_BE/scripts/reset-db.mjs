import pg from "pg";

const c = new pg.Client({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "taskflow",
});

await c.connect();
console.log("Resetting public schema...");
await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("Done. Restart the backend (npm run dev) to recreate tables.");
await c.end();
