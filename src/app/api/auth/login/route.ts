import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { comparePassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { loginLimiter } from '@/lib/auth/rate-limit';
import { writeAuditLog } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!loginLimiter.check(ip)) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }
  const { username, password } = await req.json();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !user.isActive) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: '账户已锁定，请 15 分钟后再试' }, { status: 423 });
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const updates: Record<string, any> = { failedLoginAttempts: attempts };
    if (attempts >= 5) { updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); }
    await db.update(users).set(updates).where(eq(users.id, user.id));
    await writeAuditLog({ userId: user.id, action: 'login_failed', resourceType: 'user', resourceName: username, ipAddress: ip, requestMethod: 'POST', requestPath: '/api/auth/login', responseStatus: 401 });
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }
  await createSession(user.id, ip, req.headers.get('user-agent') || undefined);
  await db.update(users).set({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
  await writeAuditLog({ userId: user.id, action: 'login', resourceType: 'user', resourceName: username, ipAddress: ip, requestMethod: 'POST', requestPath: '/api/auth/login', responseStatus: 200 });
  return NextResponse.json({ mustChangePassword: user.mustChangePassword });
}
