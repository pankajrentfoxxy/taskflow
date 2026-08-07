import 'dotenv/config';
import { sequelize, Clinic } from '../src/models/index.js';

/**
 * One-off helper: run `sequelize.sync({ alter: true })` to bring the live
 * database schema in line with the current model definitions (new columns,
 * dropped columns, type changes, indexes).
 *
 * Two-pass so a fresh DB still works: Clinic.sync() first guarantees the
 * clinics table exists before the global pass wires up FKs that reference it.
 *
 *   node scripts/syncAlter.js
 *
 * Safe to re-run. Idempotent. Doesn't drop tables.
 */
async function main() {
  await sequelize.authenticate();
  console.log('Connected.');

  await Clinic.sync();
  console.log('clinics table ready.');

  await sequelize.sync({ alter: true });
  console.log('\n✅ Schema synced with models.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
