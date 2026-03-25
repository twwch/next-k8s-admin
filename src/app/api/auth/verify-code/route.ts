import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyCode } from '@/lib/auth/email';
import { createSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { email, code } = await req.json();
  const valid = await verifyCode(email, code, 'login');
  if (!valid) { return NextResponse.json({ error: '验证码错误或已过期' }, { status: 401 }); }
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) { return NextResponse.json({ error: '用户不存在' }, { status: 401 }); }
  await createSession(user.id, ip, req.headers.get('user-agent') || undefined);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await writeAuditLog({ userId: user.id, action: 'login', resourceType: 'user', resourceName: user.username, ipAddress: ip, requestMethod: 'POST', requestPath: '/api/auth/verify-code', responseStatus: 200 });
  return NextResponse.json({ mustChangePassword: user.mustChangePassword });
}
