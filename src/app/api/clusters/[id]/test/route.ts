import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clusters } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { validateSession } from '@/lib/auth/session';
import { getK8sClient, invalidateClient } from '@/lib/k8s/client-manager';
import * as k8s from '@kubernetes/client-node';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  try {
    invalidateClient(id); // Clear cached client to force fresh connection
    const clients = await getK8sClient(id);
    const versionApi = clients.kc.makeApiClient(k8s.VersionApi);
    const versionInfo = await versionApi.getCode();

    await db.update(clusters).set({
      status: 'connected',
      lastHealthCheckAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(clusters.id, id));

    return NextResponse.json({
      success: true,
      version: versionInfo.gitVersion,
    });
  } catch (err: any) {
    await db.update(clusters).set({
      status: 'error',
      lastHealthCheckAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(clusters.id, id));
    invalidateClient(id);

    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 400 });
  }
}
