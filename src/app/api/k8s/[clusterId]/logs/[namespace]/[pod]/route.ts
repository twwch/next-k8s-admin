import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getK8sClient } from '@/lib/k8s/client-manager';

export async function GET(req: NextRequest, { params }: { params: Promise<{ clusterId: string; namespace: string; pod: string }> }) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { clusterId, namespace, pod } = await params;
  const container = req.nextUrl.searchParams.get('container') || undefined;
  const tailLines = parseInt(req.nextUrl.searchParams.get('tailLines') || '200');

  try {
    const clients = await getK8sClient(clusterId);
    const log = await clients.core.readNamespacedPodLog({
      name: pod,
      namespace,
      container,
      tailLines,
    });
    return new NextResponse(log, { headers: { 'Content-Type': 'text/plain' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
