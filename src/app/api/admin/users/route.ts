import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userRoleBindings } from '@/lib/db/schema';
import { validateSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { writeAuditLog } from '@/lib/audit/logger';
import { desc } from 'drizzle-orm';

export async function GET() {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const list = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    isActive: users.isActive,
    mustChangePassword: users.mustChangePassword,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { username, email, password, roleBindings } = await req.json();
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(users).values({
    username,
    email,
    passwordHash,
    mustChangePassword: true,
  }).returning();

  // Create role bindings if provided
  if (roleBindings && Array.isArray(roleBindings)) {
    for (const binding of roleBindings) {
      await db.insert(userRoleBindings).values({
        userId: user.id,
        roleId: binding.roleId,
        clusterId: binding.clusterId || null,
        namespace: binding.namespace || null,
        createdBy: auth.user.id,
      });
    }
  }

  await writeAuditLog({
    userId: auth.user.id,
    action: 'create',
    resourceType: 'user',
    resourceName: username,
    requestMethod: 'POST',
    requestPath: '/api/admin/users',
    responseStatus: 201,
  });

  return NextResponse.json(user, { status: 201 });
}
