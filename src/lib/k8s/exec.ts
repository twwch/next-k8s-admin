/**
 * Direct K8s exec WebSocket implementation.
 * Bypasses @kubernetes/client-node's broken stream-based Exec for tty mode.
 */
import WebSocket from 'ws';
import * as k8s from '@kubernetes/client-node';
import { getK8sClient, invalidateClient } from './client-manager';

interface ExecOptions {
  clusterId: string;
  namespace: string;
  podName: string;
  container: string;
  command: string[];
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onClose: () => void;
  onError: (err: string) => void;
}

interface ExecConnection {
  sendStdin: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  close: () => void;
}

export async function connectExec(opts: ExecOptions): Promise<ExecConnection> {
  // Force refresh client to get a fresh EKS token
  invalidateClient(opts.clusterId);
  const clients = await getK8sClient(opts.clusterId);
  const kc = clients.kc;

  const cluster = kc.getCurrentCluster();
  if (!cluster) throw new Error('No cluster configured');

  // Build exec URL
  const serverUrl = cluster.server.replace(/\/$/, '');
  const params = new URLSearchParams();
  for (const cmd of opts.command) {
    params.append('command', cmd);
  }
  if (opts.container) params.append('container', opts.container);
  params.append('stdin', 'true');
  params.append('stdout', 'true');
  params.append('stderr', 'true');
  params.append('tty', 'true');

  const execUrl = `${serverUrl}/api/v1/namespaces/${opts.namespace}/pods/${opts.podName}/exec?${params.toString()}`;
  const wsUrl = execUrl.replace(/^http/, 'ws');

  // Use applyToFetchOptions to get proper auth headers (handles EKS tokens, client certs, etc.)
  const fetchOpts = await kc.applyToFetchOptions({} as any);
  const fetchHeaders = fetchOpts.headers as Record<string, string> | undefined;

  // Also get TLS options
  const tlsOpts: any = {};
  await kc.applyToHTTPSOptions(tlsOpts);

  const wsHeaders: Record<string, string> = {};

  // Extract auth from fetch options (this properly handles all auth types)
  if (fetchHeaders) {
    if (fetchHeaders.Authorization || fetchHeaders.authorization) {
      wsHeaders['Authorization'] = fetchHeaders.Authorization || fetchHeaders.authorization;
    }
    // Handle Headers object
    if (typeof (fetchHeaders as any).get === 'function') {
      const authHeader = (fetchHeaders as any).get('Authorization') || (fetchHeaders as any).get('authorization');
      if (authHeader) wsHeaders['Authorization'] = authHeader;
    }
  }

  // Fallback: check user token directly
  if (!wsHeaders['Authorization']) {
    const user = kc.getCurrentUser();
    if (user && (user as any).token) {
      wsHeaders['Authorization'] = `Bearer ${(user as any).token}`;
    }
  }

  const wsOpts: WebSocket.ClientOptions = {
    headers: wsHeaders,
    rejectUnauthorized: false,
  };

  if (tlsOpts.cert) wsOpts.cert = tlsOpts.cert;
  if (tlsOpts.key) wsOpts.key = tlsOpts.key;
  if (tlsOpts.ca) {
    wsOpts.ca = tlsOpts.ca;
    wsOpts.rejectUnauthorized = true;
  }

  console.log('[exec] Connecting to:', wsUrl.substring(0, 80) + '...');
  console.log('[exec] Auth header:', !!wsHeaders['Authorization']);
  console.log('[exec] Auth header preview:', wsHeaders['Authorization']?.substring(0, 30) + '...');
  console.log('[exec] CA cert:', !!wsOpts.ca);

  // Connect with v4 channel protocol
  const k8sWs = new WebSocket(wsUrl, ['v4.channel.k8s.io'], wsOpts);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      k8sWs.close();
      reject(new Error('K8s exec 连接超时'));
    }, 10000);

    k8sWs.on('open', () => {
      clearTimeout(timeout);
      console.log('[exec] Connected! Protocol:', k8sWs.protocol);

      resolve({
        sendStdin(data: string) {
          if (k8sWs.readyState === WebSocket.OPEN) {
            const buf = Buffer.from(data, 'utf8');
            const frame = Buffer.alloc(buf.length + 1);
            frame.writeUInt8(0, 0); // channel 0 = stdin
            buf.copy(frame, 1);
            k8sWs.send(frame);
          }
        },
        sendResize(cols: number, rows: number) {
          if (k8sWs.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({ Width: cols, Height: rows });
            const buf = Buffer.from(msg, 'utf8');
            const frame = Buffer.alloc(buf.length + 1);
            frame.writeUInt8(4, 0); // channel 4 = resize
            buf.copy(frame, 1);
            k8sWs.send(frame);
          }
        },
        close() {
          try { k8sWs.close(); } catch {}
        },
      });
    });

    k8sWs.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
      if (data.length < 2) return;
      const channel = data[0];
      const content = data.slice(1).toString('utf8');
      if (channel === 1) opts.onStdout(content);
      else if (channel === 2) opts.onStderr(content);
      // channel 3 = status, channel 4 = resize
    });

    k8sWs.on('close', () => {
      clearTimeout(timeout);
      opts.onClose();
    });

    k8sWs.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error('[exec] WS error:', err.message);
      opts.onError(err.message);
      reject(err);
    });
  });
}
