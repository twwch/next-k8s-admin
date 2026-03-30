import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userRoleBindings, auditLogs, clusters, appTemplates, appReleases } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit/logger';
import { isSuperAdmin } from '@/lib/auth/admin-check';
import { hashPassword } from '@/lib/auth/password';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    isActive: users.isActive,
    mustChangePassword: users.mustChangePassword,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, id)).limit(1);

  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  // Get role bindings
  const bindings = await db.select().from(userRoleBindings).where(eq(userRoleBindings.userId, id));

  return NextResponse.json({ ...user, roleBindings: bindings });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!await isSuperAdmin(auth.user.id)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  await db.update(users).set({
    email: body.email,
    isActive: body.isActive,
    updatedAt: new Date(),
  }).where(eq(users.id, id));

  // Update role binding
  if (body.roleId !== undefined) {
    await db.delete(userRoleBindings).where(eq(userRoleBindings.userId, id));
    if (body.roleId) {
      await db.insert(userRoleBindings).values({
        userId: id,
        roleId: body.roleId,
        createdBy: auth.user.id,
      });
    }
  }

  await writeAuditLog({
    userId: auth.user.id,
    action: 'update',
    resourceType: 'user',
    resourceName: body.username,
    requestMethod: 'PUT',
    requestPath: `/api/admin/users/${id}`,
    responseStatus: 200,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!await isSuperAdmin(auth.user.id)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { id } = await params;

  // Protect admin user from deletion
  const [target] = await db.select({ username: users.username }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
  if (target.username === 'admin') {
    return NextResponse.json({ error: '超级管理员账户不允许删除' }, { status: 403 });
  }

  try {
    // Clear foreign key references that don't cascade
    await db.update(auditLogs).set({ userId: null }).where(eq(auditLogs.userId, id));
    await db.update(clusters).set({ createdBy: null }).where(eq(clusters.createdBy, id));
    await db.update(appTemplates).set({ createdBy: null }).where(eq(appTemplates.createdBy, id));
    await db.update(appReleases).set({ releasedBy: null }).where(eq(appReleases.releasedBy, id));

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();

    if (deleted) {
      await writeAuditLog({
        userId: auth.user.id,
        action: 'delete',
        resourceType: 'user',
        resourceName: deleted.username,
        requestMethod: 'DELETE',
        requestPath: `/api/admin/users/${id}`,
        responseStatus: 200,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete user:', err);
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!await isSuperAdmin(auth.user.id)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { id } = await params;
  const { action, newPassword } = await req.json();

  if (action === 'reset-password') {
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: '新密码至少 8 位' }, { status: 400 });
    }

    const [target] = await db.select({ username: users.username }).from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    if (target.username === 'admin') {
      return NextResponse.json({ error: '不允许重置超级管理员密码' }, { status: 403 });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, id));

    await writeAuditLog({
      userId: auth.user.id,
      action: 'reset_password',
      resourceType: 'user',
      resourceName: target.username,
      requestMethod: 'PATCH',
      requestPath: `/api/admin/users/${id}`,
      responseStatus: 200,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
