import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { emailVerifications } from '@/lib/db/schema';
import { and, eq, gt, desc } from 'drizzle-orm';

const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendVerificationCode(email: string, purpose: 'login' | 'reset') {
  // Invalidate previous unused codes for this email
  await db.update(emailVerifications)
    .set({ used: true })
    .where(and(eq(emailVerifications.email, email), eq(emailVerifications.purpose, purpose), eq(emailVerifications.used, false)));
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.insert(emailVerifications).values({ email, code, purpose, expiresAt });
  const purposeText = purpose === 'login' ? '登录' : '重置密码';
  await transporter.sendMail({
    from: process.env.SMTP_FROM, to: email,
    subject: `K8s Admin ${purposeText}验证码`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:28px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">K8s Admin</span>
        </td></tr>
        <tr><td style="padding:36px 32px 12px;text-align:center;">
          <p style="margin:0 0 6px;font-size:15px;color:#64748b;">${purposeText}验证码</p>
          <div style="margin:16px 0 20px;padding:18px 0;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1e293b;">${code}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#94a3b8;">验证码 5 分钟内有效，请勿泄露给他人</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;text-align:center;">
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <p style="margin:0 0 4px;font-size:12px;color:#cbd5e1;">如非本人操作，请忽略此邮件</p>
            <a href="https://github.com/twwch/next-k8s-admin" style="font-size:12px;color:#6366f1;text-decoration:none;">github.com/twwch/next-k8s-admin</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
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
    .orderBy(desc(emailVerifications.createdAt))
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
