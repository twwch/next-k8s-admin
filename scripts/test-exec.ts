import 'dotenv/config';
import * as k8s from '@kubernetes/client-node';
import { WebSocket } from 'ws';

// Load kubeconfig from default location
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const exec = new k8s.Exec(kc);

const namespace = process.argv[2] || 'default';
const podName = process.argv[3] || '';

if (!podName) {
  console.error('Usage: npx tsx scripts/test-exec.ts <namespace> <podName>');
  process.exit(1);
}

console.log(`Connecting to pod ${namespace}/${podName}...`);

async function main() {
  try {
    const conn = await exec.exec(
      namespace,
      podName,
      '',
      ['/bin/sh'],
      process.stdout,
      process.stderr,
      process.stdin,
      true,
      (status) => {
        console.log('\nExec status:', JSON.stringify(status));
      },
    );

    console.log('Exec connected, type is:', typeof conn, conn?.constructor?.name);
    console.log('Has send?', typeof (conn as any)?.send);
    console.log('readyState:', (conn as any)?.readyState);

    // Check if it's a WebSocket
    if (conn && typeof (conn as any).on === 'function') {
      (conn as any).on('message', (data: any) => {
        const buf = Buffer.from(data);
        console.log(`[channel ${buf[0]}] ${buf.slice(1).toString()}`);
      });
      (conn as any).on('close', () => console.log('K8s WS closed'));
      (conn as any).on('error', (err: any) => console.error('K8s WS error:', err.message));
    }

    // Keep alive
    setTimeout(() => {
      console.log('Test timeout, closing...');
      if (conn && typeof (conn as any).close === 'function') (conn as any).close();
      process.exit(0);
    }, 10000);
  } catch (err: any) {
    console.error('Exec failed:', err.message);
    process.exit(1);
  }
}

main();
