import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationCode } from '@/lib/auth/email';
import { emailCodeLimiter } from '@/lib/auth/rate-limit';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!emailCodeLimiter.check(email)) {
    return NextResponse.json({ error: '验证码发送过于频繁，请稍后再试' }, { status: 429 });
  }
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) { return NextResponse.json({ error: '该邮箱未关联任何用户' }, { status: 400 }); }
  try {
    await sendVerificationCode(email, 'login');
  } catch (err) {
    console.error('Failed to send verification code:', err);
    return NextResponse.json({ error: '验证码发送失败，请检查邮箱配置' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
