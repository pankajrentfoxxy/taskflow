import 'dotenv/config';
import {
  Authentication,
  Clinic,
  Patient,
  Visit,
  Appointment,
  Document,
  PatientTransaction,
  sequelize,
} from '../src/models/index.js';

/**
 * One-shot migration: for every non-admin Authentication row that doesn't
 * yet have a clinic_id, mint a personal Clinic, mark them the owner, and
 * stamp clinic_id on every business row they own.
 *
 * Safe to re-run — skips users that already have clinic_id set.
 */
async function main() {
  await sequelize.authenticate();

  const tx = await sequelize.transaction();
  try {
    const users = await Authentication.findAll({ transaction: tx });
    let createdClinics = 0;
    let stamped = 0;

    for (const user of users) {
      // Platform admins operate above clinics — skip.
      if (user.role === 'admin') {
        console.log(`skip admin: ${user.email}`);
        continue;
      }
      // Already migrated → just make sure their data is stamped too.
      if (user.clinic_id) {
        console.log(`already in clinic ${user.clinic_id}: ${user.email}`);
      } else {
        const clinic = await Clinic.create(
          {
            name: `${user.email}'s Clinic`,
            owner_user_id: user.user_id,
          },
          { transaction: tx },
        );
        await user.update(
          { clinic_id: clinic.id, is_clinic_owner: true },
          { transaction: tx },
        );
        createdClinics += 1;
        console.log(
          `created clinic #${clinic.id} for ${user.email} (user_id=${user.user_id})`,
        );
      }

      // (Re-)stamp child rows belonging to this user.
      const clinicId = user.clinic_id || (await user.reload({ transaction: tx })).clinic_id;
      const tables = [
        ['patients', Patient],
        ['visits', Visit],
        ['appointments', Appointment],
        ['documents', Document],
        ['patient_transactions', PatientTransaction],
      ];

      for (const [label, Model] of tables) {
        const [n] = await Model.update(
          { clinic_id: clinicId },
          {
            where: { user_id: user.user_id, clinic_id: null },
            transaction: tx,
          },
        );
        if (n > 0) {
          console.log(`  ${label}: stamped ${n} row(s) with clinic_id=${clinicId}`);
          stamped += n;
        }
      }
    }

    await tx.commit();
    console.log(`\nDone. Created ${createdClinics} clinic(s); stamped ${stamped} row(s).`);
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
