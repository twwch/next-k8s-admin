import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clusters } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateSession } from '@/lib/auth/session';
import { encrypt } from '@/lib/crypto';
import { writeAuditLog } from '@/lib/audit/logger';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, id)).limit(1);
  if (!cluster) return NextResponse.json({ error: '集群不存在' }, { status: 404 });

  // Don't return encrypted credentials
  const { kubeconfig, saToken, ...safe } = cluster;
  return NextResponse.json(safe);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, any> = {
    displayName: body.displayName,
    apiServerUrl: body.apiServerUrl,
    authType: body.authType,
    caCert: body.caCert,
    description: body.description,
    updatedAt: new Date(),
  };

  if (body.kubeconfig) updates.kubeconfig = encrypt(body.kubeconfig);
  if (body.saToken) updates.saToken = encrypt(body.saToken);

  const [updated] = await db.update(clusters).set(updates).where(eq(clusters.id, id)).returning();

  await writeAuditLog({
    userId: auth.user.id,
    action: 'update',
    resourceType: 'cluster',
    resourceName: updated.name,
    requestMethod: 'PUT',
    requestPath: `/api/clusters/${id}`,
    responseStatus: 200,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db.delete(clusters).where(eq(clusters.id, id)).returning();

  if (deleted) {
    await writeAuditLog({
      userId: auth.user.id,
      action: 'delete',
      resourceType: 'cluster',
      resourceName: deleted.name,
      requestMethod: 'DELETE',
      requestPath: `/api/clusters/${id}`,
      responseStatus: 200,
    });
  }

  return NextResponse.json({ success: true });
}
