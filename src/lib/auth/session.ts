import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { signJwt, verifyJwt } from './jwt';

const SESSION_COOKIE = 'k8s_session';
const EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24');

export function generateToken(userId: string): string {
  const expiresAt = Date.now() + EXPIRY_HOURS * 60 * 60 * 1000;
  return signJwt({ userId, exp: expiresAt });
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax',
    path: '/', maxAge: EXPIRY_HOURS * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function validateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user || !user.isActive) return null;
  return { session: { token }, user };
}
