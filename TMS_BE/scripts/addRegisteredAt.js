import 'dotenv/config';
import { sequelize } from '../src/models/index.js';

/**
 * One-shot migration to add the `registered_at` column to an existing
 * `patients` table. Sequelize's auto-sync can't do this in one statement
 * because Postgres refuses `ALTER TABLE ... ADD COLUMN ... NOT NULL`
 * when the table already has rows (the existing rows would violate the
 * NOT NULL constraint). So we do it in three:
 *
 *   1. ADD COLUMN ... DATE (nullable)
 *   2. UPDATE ... SET registered_at = DATE(created_at) for existing rows
 *   3. ALTER COLUMN ... SET NOT NULL + SET DEFAULT CURRENT_DATE
 *
 * Idempotent — each step checks whether the work is already done before
 * running, so re-running this script is safe.
 */
async function main() {
  await sequelize.authenticate();

  // Step 1: add the column nullable if it doesn't exist yet.
  const [colRows] = await sequelize.query(
    `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'patients'
        AND column_name = 'registered_at'`
  );
  const exists = colRows.length > 0;

  if (!exists) {
    console.log('  + adding patients.registered_at (DATE, nullable)…');
    await sequelize.query(
      `ALTER TABLE "patients" ADD COLUMN "registered_at" DATE`
    );
  } else {
    console.log('  · patients.registered_at already exists, skipping ADD.');
  }

  // Step 2: backfill from created_at on any row that's still NULL.
  const [, updateMeta] = await sequelize.query(
    `UPDATE patients
        SET registered_at = (created_at AT TIME ZONE 'UTC')::date
      WHERE registered_at IS NULL`
  );
  console.log(`  · backfilled ${updateMeta?.rowCount ?? 0} row(s).`);

  // Step 3: tighten the constraint + set default for future inserts.
  const colInfo = exists
    ? colRows[0]
    : (await sequelize.query(
        `SELECT is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'patients'
            AND column_name = 'registered_at'`
      ))[0][0];

  if (colInfo.is_nullable === 'YES') {
    console.log('  + setting NOT NULL…');
    await sequelize.query(
      `ALTER TABLE "patients" ALTER COLUMN "registered_at" SET NOT NULL`
    );
  } else {
    console.log('  · already NOT NULL.');
  }

  if (!colInfo.column_default) {
    console.log('  + setting DEFAULT CURRENT_DATE…');
    await sequelize.query(
      `ALTER TABLE "patients" ALTER COLUMN "registered_at" SET DEFAULT CURRENT_DATE`
    );
  } else {
    console.log(`  · default already set (${colInfo.column_default}).`);
  }

  console.log('✓ patients.registered_at migration complete.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
