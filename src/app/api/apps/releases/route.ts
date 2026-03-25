import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appReleases, users } from '@/lib/db/schema';
import { validateSession } from '@/lib/auth/session';
import { desc, eq } from 'drizzle-orm';

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
