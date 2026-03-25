import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';

export async function GET() {
  const auth = await validateSession();
  if (!auth) { return NextResponse.json({ error: '未登录' }, { status: 401 }); }
  return NextResponse.json({
    id: auth.user.id, username: auth.user.username, email: auth.user.email,
    mustChangePassword: auth.user.mustChangePassword,
    wsToken: auth.session.token,
  });
}
