import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appReleases, appTemplates, clusters, users } from '@/lib/db/schema';
import { validateSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit/logger';
import { applyResource, type ResourceKind } from '@/lib/k8s/resources';
import { sendFeishuNotification } from '@/lib/notify/feishu';
import { and, desc, eq, isNull } from 'drizzle-orm';
import yaml from 'yaml';

function renderTemplateYaml(templateYaml: string, variables: Record<string, string>): string {
  return templateYaml.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

function parseRenderedYaml(rendered: string): any[] {
  const docs = yaml.parseAllDocuments(rendered);
  return docs.map(d => d.toJSON()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const list = await db
    .select({
      id: appReleases.id,
      appTemplateId: appReleases.appTemplateId,
      clusterId: appReleases.clusterId,
      namespace: appReleases.namespace,
      name: appReleases.name,
      values: appReleases.values,
      status: appReleases.status,
      revision: appReleases.revision,
      message: appReleases.message,
      releasedBy: appReleases.releasedBy,
      createdAt: appReleases.createdAt,
      updatedAt: appReleases.updatedAt,
      operator: users.username,
    })
    .from(appReleases)
    .leftJoin(users, eq(appReleases.releasedBy, users.id))
    .orderBy(desc(appReleases.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { appTemplateId, clusterId, namespace, name, values, message: msg } = await req.json();

  if (!msg || !msg.trim()) {
    return NextResponse.json({ error: '请填写变更说明' }, { status: 400 });
  }

  // Load template
  const [template] = await db.select().from(appTemplates).where(eq(appTemplates.id, appTemplateId)).limit(1);
  if (!template) return NextResponse.json({ error: '模板不存在' }, { status: 404 });

  // Load cluster info
  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, clusterId)).limit(1);
  if (!cluster) return NextResponse.json({ error: '集群不存在' }, { status: 404 });

  // Get raw YAML from template
  const templateData = template.template as any;
  const rawYaml = templateData?.yaml || (typeof templateData === 'string' ? templateData : JSON.stringify(templateData));

  // Render variables at string level (no YAML parsing issues with {{VAR}})
  const renderedYaml = renderTemplateYaml(rawYaml, values || {});

  // Parse rendered YAML into K8s manifests
  let manifests: any[];
  try {
    manifests = parseRenderedYaml(renderedYaml);
  } catch (e: any) {
    return NextResponse.json({ error: '模板渲染后 YAML 解析失败: ' + e.message }, { status: 400 });
  }

  // Get latest revision for this release name + cluster + namespace
  const [latest] = await db.select({ revision: appReleases.revision })
    .from(appReleases)
    .where(and(
      eq(appReleases.name, name),
      eq(appReleases.clusterId, clusterId),
      namespace ? eq(appReleases.namespace, namespace) : isNull(appReleases.namespace),
    ))
    .orderBy(desc(appReleases.revision))
    .limit(1);
  const revision = (latest?.revision ?? 0) + 1;

  // Create release record
  const [release] = await db.insert(appReleases).values({
    appTemplateId,
    clusterId,
    namespace,
    name,
    values,
    renderedManifests: { yaml: renderedYaml, manifests },
    status: 'pending',
    revision,
    message: msg.trim(),
    releasedBy: auth.user.id,
  }).returning();

  // Apply each resource to K8s (create or update, like kubectl apply)
  let status: 'applied' | 'failed' = 'applied';
  let failError = '';
  try {
    for (const manifest of manifests) {
      const kind = (manifest?.kind?.toLowerCase() + 's') as ResourceKind;
      const resourceNamespace = manifest?.metadata?.namespace || namespace;
      await applyResource(clusterId, kind, manifest, resourceNamespace);
    }
  } catch (err: any) {
    status = 'failed';
    failError = err.message || 'Unknown error';
  }

  // Update release status
  await db.update(appReleases)
    .set({ status, updatedAt: new Date() })
    .where(eq(appReleases.id, release.id));

  await writeAuditLog({
    userId: auth.user.id,
    action: 'create',
    resourceType: 'app_release',
    resourceName: name,
    clusterId,
    namespace,
    requestMethod: 'POST',
    requestPath: '/api/apps/releases',
    responseStatus: status === 'applied' ? 201 : 500,
  });

  // Extract image from values or manifests
  const image = values?.IMAGE || values?.image
    || manifests[0]?.spec?.template?.spec?.containers?.[0]?.image
    || '-';

  // Send notification if enabled
  if (cluster.notifyEnabled && cluster.webhookUrl) {
    sendFeishuNotification(cluster.webhookUrl, {
      releaseName: name,
      clusterName: cluster.displayName || cluster.name,
      namespace,
      templateName: template.name,
      image,
      revision,
      status,
      message: msg.trim(),
      operator: auth.user.username,
      time: new Date().toLocaleString('zh-CN'),
    });
  }

  if (status === 'failed') {
    return NextResponse.json({ ...release, status, error: failError }, { status: 500 });
  }
  return NextResponse.json({ ...release, status }, { status: 201 });
}
