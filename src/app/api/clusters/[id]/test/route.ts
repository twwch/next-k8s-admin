import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getK8sClient } from '@/lib/k8s/client-manager';
import * as k8s from '@kubernetes/client-node';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  try {
    const clients = await getK8sClient(id);
    const versionApi = clients.kc.makeApiClient(k8s.VersionApi);
    const versionInfo = await versionApi.getCode();
    return NextResponse.json({
      success: true,
      version: versionInfo.gitVersion,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 400 });
  }
}
