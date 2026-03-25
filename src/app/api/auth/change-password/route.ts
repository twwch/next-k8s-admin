import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePassword } from '@/lib/auth/password';
import { validateSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) { return NextResponse.json({ error: '未登录' }, { status: 401 }); }
  const { currentPassword, newPassword } = await req.json();
  if (newPassword.length < 8) { return NextResponse.json({ error: '新密码至少 8 位' }, { status: 400 }); }
  const valid = await comparePassword(currentPassword, auth.user.passwordHash);
  if (!valid) { return NextResponse.json({ error: '当前密码错误' }, { status: 400 }); }
  const newHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, auth.user.id));
  await writeAuditLog({ userId: auth.user.id, action: 'change_password', resourceType: 'user', resourceName: auth.user.username, requestMethod: 'POST', requestPath: '/api/auth/change-password', responseStatus: 200 });
  return NextResponse.json({ success: true });
}
