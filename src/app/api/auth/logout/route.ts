import { NextRequest, NextResponse } from 'next/server';
import { validateSession, clearSessionCookie } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit/logger';

export async function POST(req: NextRequest) {
  const auth = await validateSession();
  if (auth) {
    await writeAuditLog({ userId: auth.user.id, action: 'logout', resourceType: 'user', resourceName: auth.user.username, requestMethod: 'POST', requestPath: '/api/auth/logout', responseStatus: 200 });
  }
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
