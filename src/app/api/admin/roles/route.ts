import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roles, rolePermissions } from '@/lib/db/schema';
import { validateSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit/logger';
import { desc } from 'drizzle-orm';

export async function GET() {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const list = await db.select().from(roles).orderBy(desc(roles.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { name, displayName, description, permissions } = await req.json();

  const [role] = await db.insert(roles).values({
    name,
    displayName,
    description,
    isSystem: false,
  }).returning();

  if (permissions && Array.isArray(permissions)) {
    for (const perm of permissions) {
      await db.insert(rolePermissions).values({
        roleId: role.id,
        resource: perm.resource,
        actions: perm.actions,
      });
    }
  }

  await writeAuditLog({
    userId: auth.user.id,
    action: 'create',
    resourceType: 'role',
    resourceName: name,
    requestMethod: 'POST',
    requestPath: '/api/admin/roles',
    responseStatus: 201,
  });

  return NextResponse.json(role, { status: 201 });
}
