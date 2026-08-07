import 'dotenv/config';
import { sequelize } from '../src/models/index.js';

/**
 * One-shot fix: the multi-clinic refactor (see docs/multi-clinic-refactor.md)
 * left `clinic_id NOT NULL` on the five business tables. The Patient / Visit /
 * PatientTransaction models have since been rolled back to the pre-refactor
 * shape and no longer carry `clinic_id` as an attribute — so Sequelize emits
 * INSERTs without that column, and Postgres rejects the row with a NOT NULL
 * violation.
 *
 * Drop the constraint so the models work as written. The columns stay (with
 * their data) so the clinic refactor can be reapplied later without a backfill.
 *
 *   node scripts/relaxClinicId.js
 */
async function main() {
  await sequelize.authenticate();
  console.log('Connected.');

  const tables = [
    'patients',
    'visits',
    'appointments',
    'documents',
    'patient_transactions',
  ];

  for (const t of tables) {
    try {
      // Skip if the column doesn't exist (table was dropped or never had it).
      const [rows] = await sequelize.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = :t
           AND column_name = 'clinic_id'`,
        { replacements: { t } },
      );
      if (rows.length === 0) {
        console.log(`  ${t}: no clinic_id column — skipping.`);
        continue;
      }
      await sequelize.query(`ALTER TABLE ${t} ALTER COLUMN clinic_id DROP NOT NULL`);
      console.log(`  ${t}: NOT NULL dropped from clinic_id.`);
    } catch (err) {
      console.error(`  ${t}: failed —`, err.message);
    }
  }

  // authentication.clinic_id was added nullable already; leave as-is.

  console.log('\nDone. Restart the backend if it isn’t auto-restarting.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
