import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clusters } from '@/lib/db/schema';
import { validateSession } from '@/lib/auth/session';
import { encrypt } from '@/lib/crypto';
import { writeAuditLog } from '@/lib/audit/logger';
import { desc } from 'drizzle-orm';

export async function GET() {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const list = await db.select({
    id: clusters.id,
    name: clusters.name,
    displayName: clusters.displayName,
    apiServerUrl: clusters.apiServerUrl,
    authType: clusters.authType,
    status: clusters.status,
    lastHealthCheckAt: clusters.lastHealthCheckAt,
    description: clusters.description,
    createdAt: clusters.createdAt,
  }).from(clusters).orderBy(desc(clusters.createdAt));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json();
  const { name, displayName, apiServerUrl, authType, kubeconfig, saToken, caCert, description } = body;

  const [cluster] = await db.insert(clusters).values({
    name,
    displayName,
    apiServerUrl,
    authType,
    kubeconfig: kubeconfig ? encrypt(kubeconfig) : null,
    saToken: saToken ? encrypt(saToken) : null,
    caCert,
    description,
    createdBy: auth.user.id,
  }).returning();

  await writeAuditLog({
    userId: auth.user.id,
    action: 'create',
    resourceType: 'cluster',
    resourceName: name,
    requestMethod: 'POST',
    requestPath: '/api/clusters',
    responseStatus: 201,
  });

  return NextResponse.json(cluster, { status: 201 });
}
