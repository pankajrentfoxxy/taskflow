import 'dotenv/config';
import { sequelize } from '../src/models/index.js';

/**
 * One-shot migration to add the `completed_at` column to an existing
 * `appointments` table. The column is nullable — it only carries a value
 * when status='completed'. For historical rows that were already completed
 * before this column existed we backfill from `updated_at::date` as the
 * best available proxy for "when was it marked done."
 *
 * Idempotent — each step checks whether the work is already done.
 */
async function main() {
  await sequelize.authenticate();

  // Step 1: add the column nullable if it doesn't exist.
  const [colRows] = await sequelize.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'completed_at'`
  );
  const exists = colRows.length > 0;

  if (!exists) {
    console.log('  + adding appointments.completed_at (DATE, nullable)…');
    await sequelize.query(
      `ALTER TABLE "appointments" ADD COLUMN "completed_at" DATE`
    );
  } else {
    console.log('  · appointments.completed_at already exists, skipping ADD.');
  }

  // Step 2: backfill completed_at = (updated_at)::date for every
  // already-completed row that doesn't yet have a value. Rows in any
  // other status keep NULL — that's the canonical "not done" signal.
  const [, updateMeta] = await sequelize.query(
    `UPDATE appointments
        SET completed_at = (updated_at AT TIME ZONE 'UTC')::date
      WHERE status = 'completed' AND completed_at IS NULL`
  );
  console.log(`  · backfilled ${updateMeta?.rowCount ?? 0} completed row(s).`);

  console.log('✓ appointments.completed_at migration complete.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
