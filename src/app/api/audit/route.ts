import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { validateSession } from '@/lib/auth/session';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const action = searchParams.get('action');
  const resourceType = searchParams.get('resourceType');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const conditions = [];
  if (action) conditions.push(eq(auditLogs.action, action));
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
  if (startDate) conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(auditLogs.createdAt, new Date(endDate)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceName: auditLogs.resourceName,
      namespace: auditLogs.namespace,
      requestMethod: auditLogs.requestMethod,
      responseStatus: auditLogs.responseStatus,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      username: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json(logs);
}
