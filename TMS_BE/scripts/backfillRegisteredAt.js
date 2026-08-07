import 'dotenv/config';
import { sequelize } from '../src/models/index.js';

/**
 * One-shot migration: every patient row that doesn't yet have a
 * `registered_at` value gets one stamped to the same calendar day as its
 * auto `created_at`. Idempotent — re-running it no-ops once all rows are
 * filled.
 *
 * Run AFTER syncAlter.js (which adds the column on existing DBs).
 */
async function main() {
  await sequelize.authenticate();

  const [, meta] = await sequelize.query(
    `UPDATE patients
        SET registered_at = (created_at AT TIME ZONE 'UTC')::date
      WHERE registered_at IS NULL`
  );

  // Postgres returns rowCount on meta for UPDATE statements via sequelize.query.
  const rows = meta?.rowCount ?? 0;
  console.log(`Backfilled registered_at on ${rows} patient row(s).`);

  await sequelize.close();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
