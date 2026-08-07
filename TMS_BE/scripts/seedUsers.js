import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Authentication, sequelize } from '../src/models/index.js';

const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

// plan ∈ { trial, quarterly, yearly }
// role: spread across dental specialties
const USERS = [
  {
    email: 'dr.aanya@dms.local',
    role: 'orthodontist',
    plan: 'yearly',
    plan_start_date: daysFromNow(-30),
    plan_end_date: daysFromNow(335),
    is_plan_active: true,
    is_blocked: false,
    phone_number: '9810001001',
  },
  {
    email: 'dr.bharat@dms.local',
    role: 'dentist',
    plan: 'quarterly',
    plan_start_date: daysFromNow(-10),
    plan_end_date: daysFromNow(170),
    is_plan_active: true,
    is_blocked: false,
    phone_number: '9810001002',
  },
  {
    email: 'dr.charvi@dms.local',
    role: 'periodontist',
    plan: 'trial',
    plan_start_date: daysFromNow(-25),
    plan_end_date: daysFromNow(5),
    is_plan_active: true,
    is_blocked: false,
    phone_number: '9810001003',
  },
  {
    email: 'dr.deepak@dms.local',
    role: 'endodontist',
    plan: 'quarterly',
    plan_start_date: daysFromNow(-200),
    plan_end_date: daysFromNow(-20), // expired
    is_plan_active: false,
    is_blocked: false,
    phone_number: '9810001004',
  },
  {
    email: 'dr.eshaan@dms.local',
    role: 'oral_surgeon',
    plan: 'yearly',
    plan_start_date: daysFromNow(-60),
    plan_end_date: daysFromNow(305),
    is_plan_active: true,
    is_blocked: true, // blocked admin-side
    phone_number: '9810001005',
  },
  {
    email: 'dr.farah@dms.local',
    role: 'pediatric_dentist',
    plan: 'trial',
    plan_start_date: daysFromNow(-1),
    plan_end_date: daysFromNow(29),
    is_plan_active: true,
    is_blocked: false,
    phone_number: '9810001006',
  },
  {
    email: 'dr.gaurav@dms.local',
    role: 'prosthodontist',
    plan: 'yearly',
    plan_start_date: daysFromNow(-15),
    plan_end_date: daysFromNow(350),
    is_plan_active: true,
    is_blocked: false,
    phone_number: '9810001007',
  },
  {
    email: 'dr.hina@dms.local',
    role: 'oral_pathologist',
    plan: 'quarterly',
    plan_start_date: daysFromNow(-50),
    plan_end_date: daysFromNow(130),
    is_plan_active: true,
    is_blocked: false,
    phone_number: '9810001008',
  },
];

const PASSWORD = 'Test@1234';

async function main() {
  await sequelize.authenticate();

  let created = 0;
  let updated = 0;

  for (const u of USERS) {
    const existing = await Authentication.findOne({ where: { email: u.email } });
    if (existing) {
      await existing.update({
        role: u.role,
        plan: u.plan,
        plan_start_date: u.plan_start_date,
        plan_end_date: u.plan_end_date,
        is_plan_active: u.is_plan_active,
        is_blocked: u.is_blocked,
      });
      updated += 1;
      console.log(`updated: ${u.email} (user_id=${existing.user_id}, role=${u.role}, plan=${u.plan})`);
      continue;
    }

    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const user = await Authentication.create({
      email: u.email,
      password_hash,
      role: u.role,
      phone_country_code: 91,
      phone_number: u.phone_number,
      is_active: !u.is_blocked,
      is_blocked: u.is_blocked,
      is_social: false,
      plan: u.plan,
      plan_start_date: u.plan_start_date,
      plan_end_date: u.plan_end_date,
      is_plan_active: u.is_plan_active,
      last_login: Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000,
    });
    created += 1;
    console.log(`created: ${user.email} (user_id=${user.user_id}, role=${user.role}, plan=${user.plan})`);
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}.`);
  console.log(`All seeded users have password: ${PASSWORD}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
