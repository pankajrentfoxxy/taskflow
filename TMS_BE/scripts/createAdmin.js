import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Authentication, sequelize } from '../src/models/index.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dms.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

async function main() {
  await sequelize.authenticate();

  const existing = await Authentication.findOne({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    await existing.update({
      role: 'admin',
      plan: 'yearly',
      is_plan_active: true,
      is_active: true,
      is_blocked: false,
    });
    console.log(`Admin refreshed: ${ADMIN_EMAIL} (user_id=${existing.user_id})`);
    await sequelize.close();
    return;
  }

  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const now = new Date();
  const farFuture = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  const admin = await Authentication.create({
    email: ADMIN_EMAIL,
    password_hash,
    role: 'admin',
    is_active: true,
    is_blocked: false,
    is_social: false,
    plan: 'yearly',
    plan_start_date: now,
    plan_end_date: farFuture,
    is_plan_active: true,
  });

  console.log('Admin created:');
  console.log('  user_id:', admin.user_id);
  console.log('  email:  ', ADMIN_EMAIL);
  console.log('  password:', ADMIN_PASSWORD);
  await sequelize.close();
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
