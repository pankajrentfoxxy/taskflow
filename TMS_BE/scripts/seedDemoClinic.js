import 'dotenv/config';
import { sequelize, Clinic } from '../src/models/index.js';

/**
 * One-shot bootstrap to unblock the clinic-scoping refactor on an existing DB.
 *
 *  1. Ensures the `clinics` table exists (Clinic.sync()).
 *  2. Adds nullable `clinic_id` (and `is_clinic_owner`) columns to every table
 *     the refactor wants to scope, on TABLES THAT ALREADY EXIST. Tables added
 *     by the refactor itself (e.g. `appointments`) are skipped — Sequelize sync
 *     will create them fresh with the columns already in place.
 *  3. Creates a single "Demo Clinic" if none exists, picking the lowest user_id
 *     from `authentication` as the owner.
 *  4. Stamps that clinic_id on every existing row of those tables, plus on
 *     every non-admin row in `authentication` that doesn't already have one.
 *
 * Safe to re-run — every step is idempotent. All reads of `authentication` are
 * raw SQL (the Authentication ORM model expects columns that may not exist on
 * disk yet, so SELECTs through the ORM would crash).
 *
 *   node scripts/seedDemoClinic.js
 */

const tableExists = async (name) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = :t`,
    { replacements: { t: name } },
  );
  return rows.length > 0;
};

async function main() {
  await sequelize.authenticate();
  console.log('Connected.');

  // 1) Make sure the target table exists before we add FKs that reference it.
  await Clinic.sync();
  console.log('clinics table ready.');

  // 2a) authentication: add the two clinic-related columns the refactor added.
  if (await tableExists('authentication')) {
    await sequelize.query(
      `ALTER TABLE authentication ADD COLUMN IF NOT EXISTS clinic_id INTEGER`,
    );
    await sequelize.query(
      `ALTER TABLE authentication
       ADD COLUMN IF NOT EXISTS is_clinic_owner BOOLEAN NOT NULL DEFAULT false`,
    );
    console.log('authentication: clinic_id + is_clinic_owner columns ensured.');
  } else {
    console.log('authentication: table not yet created — skipping.');
  }

  // 2b) business tables: add nullable clinic_id where the table already exists.
  const candidateTables = [
    'patients',
    'visits',
    'appointments',
    'documents',
    'patient_transactions',
  ];
  const existing = [];
  for (const t of candidateTables) {
    if (!(await tableExists(t))) {
      console.log(`  ${t}: not yet created — skipping (sync will create it).`);
      continue;
    }
    await sequelize.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS clinic_id INTEGER`);
    existing.push(t);
  }
  console.log('clinic_id ensured on:', existing.join(', ') || '(none)');

  // 3) Create the demo clinic if there isn't one yet.
  let demo = await Clinic.findOne({ order: [['id', 'ASC']] });
  if (!demo) {
    // Find an owner via raw SQL — the Authentication ORM model selects columns
    // that may not yet exist on disk, so going through the model would crash.
    const [ownerRows] = await sequelize.query(
      `SELECT user_id FROM authentication ORDER BY user_id ASC LIMIT 1`,
    );
    if (ownerRows.length === 0) {
      throw new Error(
        'No users in `authentication` table — create a doctor account first, then re-run.',
      );
    }
    const ownerUserId = ownerRows[0].user_id;

    demo = await Clinic.create({
      name: 'Demo Clinic',
      owner_user_id: ownerUserId,
      timezone: 'Asia/Kolkata',
      plan: 'trial',
      plan_start_date: new Date(),
      // 1-year trial window so the gate doesn't trip immediately.
      plan_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      is_plan_active: true,
    });
    console.log(`Created Demo Clinic id=${demo.id} owned by user_id=${ownerUserId}.`);

    await sequelize.query(
      `UPDATE authentication
       SET is_clinic_owner = true, clinic_id = :cid
       WHERE user_id = :uid`,
      { replacements: { cid: demo.id, uid: ownerUserId } },
    );
  } else {
    console.log(`Demo clinic already exists: id=${demo.id} name="${demo.name}".`);
  }

  // 4) Backfill every row that still has a NULL clinic_id.
  let totalStamped = 0;
  for (const t of existing) {
    const [, meta] = await sequelize.query(
      `UPDATE ${t} SET clinic_id = :id WHERE clinic_id IS NULL`,
      { replacements: { id: demo.id } },
    );
    const n = meta?.rowCount ?? 0;
    console.log(`  ${t}: stamped ${n} row(s).`);
    totalStamped += n;
  }

  // Doctors / users without a clinic — point them at the demo clinic.
  // Platform admins (role === 'admin') stay above the clinic scope.
  if (await tableExists('authentication')) {
    const [, authMeta] = await sequelize.query(
      `UPDATE authentication
       SET clinic_id = :id
       WHERE clinic_id IS NULL AND role <> 'admin'`,
      { replacements: { id: demo.id } },
    );
    const authStamped = authMeta?.rowCount ?? 0;
    console.log(`  authentication: stamped ${authStamped} doctor(s).`);
    totalStamped += authStamped;
  }

  console.log(`\nDone. Backfilled ${totalStamped} row(s) to clinic_id=${demo.id}.`);
  console.log('You can now run `npm run dev` — sync will succeed.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
