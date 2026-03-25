import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appReleases, clusters } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { validateSession } from '@/lib/auth/session';
import { applyResource, type ResourceKind } from '@/lib/k8s/resources';
import { writeAuditLog } from '@/lib/audit/logger';
import { sendFeishuNotification } from '@/lib/notify/feishu';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;

  // Find target release
  const [target] = await db.select().from(appReleases).where(eq(appReleases.id, id)).limit(1);
  if (!target) return NextResponse.json({ error: '发布记录不存在' }, { status: 404 });

  // Get latest revision number for this release name + cluster + namespace
  const [latest] = await db
    .select()
    .from(appReleases)
    .where(
      and(
        eq(appReleases.name, target.name),
        eq(appReleases.clusterId, target.clusterId),
        target.namespace ? eq(appReleases.namespace, target.namespace) : isNull(appReleases.namespace),
      ),
    )
    .orderBy(desc(appReleases.revision))
    .limit(1);

  const newRevision = (latest?.revision ?? target.revision) + 1;
  const manifests = Array.isArray(target.renderedManifests) ? target.renderedManifests : [target.renderedManifests];

  // Create new release from target manifests
  const [newRelease] = await db.insert(appReleases).values({
    appTemplateId: target.appTemplateId,
    clusterId: target.clusterId,
    namespace: target.namespace,
    name: target.name,
    values: target.values,
    renderedManifests: target.renderedManifests,
    status: 'pending',
    revision: newRevision,
    message: `回滚至 Revision #${target.revision}`,
    releasedBy: auth.user.id,
  }).returning();

  // Re-apply manifests to K8s
  let status: 'applied' | 'failed' = 'applied';
  try {
    for (const manifest of manifests) {
      const kind = (manifest as any)?.kind?.toLowerCase() + 's' as ResourceKind;
      const resourceNamespace = (manifest as any)?.metadata?.namespace || target.namespace;
      await applyResource(target.clusterId, kind, manifest, resourceNamespace);
    }
  } catch {
    status = 'failed';
  }

  await db.update(appReleases)
    .set({ status, updatedAt: new Date() })
    .where(eq(appReleases.id, newRelease.id));

  // Mark original as rolled_back
  await db.update(appReleases)
    .set({ status: 'rolled_back', updatedAt: new Date() })
    .where(eq(appReleases.id, id));

  await writeAuditLog({
    userId: auth.user.id,
    action: 'update',
    resourceType: 'app_release',
    resourceName: target.name,
    clusterId: target.clusterId,
    namespace: target.namespace ?? undefined,
    requestMethod: 'POST',
    requestPath: `/api/apps/releases/${id}/rollback`,
    responseStatus: 200,
  });

  // Send notification if enabled
  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, target.clusterId)).limit(1);
  if (cluster?.notifyEnabled && cluster.webhookUrl) {
    sendFeishuNotification(cluster.webhookUrl, {
      releaseName: target.name,
      clusterName: cluster.displayName || cluster.name,
      namespace: target.namespace ?? '-',
      revision: newRevision,
      status: 'rolled_back',
      message: `回滚至 Revision #${target.revision}`,
      operator: auth.user.username,
      time: new Date().toLocaleString('zh-CN'),
    });
  }

  return NextResponse.json({ ...newRelease, status });
}
