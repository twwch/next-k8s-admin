import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { emailVerifications } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendVerificationCode(email: string, purpose: 'login' | 'reset') {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.insert(emailVerifications).values({ email, code, purpose, expiresAt });
  await transporter.sendMail({
    from: process.env.SMTP_FROM, to: email,
    subject: `K8s Admin 验证码: ${code}`,
    text: `您的验证码是: ${code}，有效期 5 分钟。`,
  });
  return true;
}

export async function verifyCode(email: string, code: string, purpose: 'login' | 'reset') {
  const records = await db.select().from(emailVerifications)
    .where(and(
      eq(emailVerifications.email, email),
      eq(emailVerifications.purpose, purpose),
      eq(emailVerifications.used, false),
      gt(emailVerifications.expiresAt, new Date()),
    ))
    .orderBy(emailVerifications.createdAt)
    .limit(1);
  if (records.length === 0) return false;
  const record = records[0];
  if (record.attempts >= 3) {
    await db.update(emailVerifications).set({ used: true }).where(eq(emailVerifications.id, record.id));
    return false;
  }
  if (record.code !== code) {
    await db.update(emailVerifications).set({ attempts: record.attempts + 1 }).where(eq(emailVerifications.id, record.id));
    return false;
  }
  await db.update(emailVerifications).set({ used: true }).where(eq(emailVerifications.id, record.id));
  return true;
}
