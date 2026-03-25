import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getUserBindings, checkPermission } from '@/lib/rbac/check';

export async function GET(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const clusterId = searchParams.get('clusterId');
  const resource = searchParams.get('resource');

  if (!clusterId || !resource) {
    return NextResponse.json({ canCreate: false, canUpdate: false, canDelete: false });
  }

  const bindings = await getUserBindings(auth.user.id);

  return NextResponse.json({
    canCreate: checkPermission(bindings, { clusterId, namespace: '*', resource, action: 'create' }),
    canUpdate: checkPermission(bindings, { clusterId, namespace: '*', resource, action: 'update' }),
    canDelete: checkPermission(bindings, { clusterId, namespace: '*', resource, action: 'delete' }),
  });
}
