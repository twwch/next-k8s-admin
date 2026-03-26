import 'dotenv/config';
import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import crypto from 'crypto';

async function resetAdmin() {
  const [admin] = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);

  if (!admin) {
    console.log('Admin user not found. Run db:seed first.');
    process.exit(1);
  }

  const newPassword = crypto.randomBytes(8).toString('hex');
  const hash = await hashPassword(newPassword);

  await db.update(users).set({
    passwordHash: hash,
    mustChangePassword: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }).where(eq(users.id, admin.id));

  console.log('');
  console.log('='.repeat(50));
  console.log('  Admin password has been reset:');
  console.log(`    Username: admin`);
  console.log(`    Password: ${newPassword}`);
  console.log('    (Must change password on first login)');
  console.log('='.repeat(50));
  console.log('');

  process.exit(0);
}

resetAdmin().catch((err) => { console.error(err); process.exit(1); });
