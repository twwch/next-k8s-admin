import { WebSocketServer, WebSocket } from 'ws';
import { PassThrough } from 'stream';
import { db } from '@/lib/db';
import { sessions, users, userRoleBindings, rolePermissions, clusters as clustersTable } from '@/lib/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { checkPermission, type RoleBinding } from '@/lib/rbac/check';
import { getK8sClient, invalidateClient } from '@/lib/k8s/client-manager';
import * as k8s from '@kubernetes/client-node';

let started = false;

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  bindings?: RoleBinding[];
}

async function authenticate(token: string) {
  const result = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (result.length === 0) return null;
  return result[0].user;
}

async function loadUserBindings(userId: string): Promise<RoleBinding[]> {
  const rows = await db
    .select({
      roleId: userRoleBindings.roleId,
      clusterId: userRoleBindings.clusterId,
      namespace: userRoleBindings.namespace,
      resource: rolePermissions.resource,
      actions: rolePermissions.actions,
    })
    .from(userRoleBindings)
    .innerJoin(rolePermissions, eq(userRoleBindings.roleId, rolePermissions.roleId))
    .where(eq(userRoleBindings.userId, userId));

  const bindingMap = new Map<string, RoleBinding>();
  for (const row of rows) {
    const key = `${row.roleId}:${row.clusterId}:${row.namespace}`;
    if (!bindingMap.has(key)) {
      bindingMap.set(key, { roleId: row.roleId, clusterId: row.clusterId, namespace: row.namespace, permissions: [] });
    }
    bindingMap.get(key)!.permissions.push({ resource: row.resource, actions: row.actions as string[] });
  }
  return Array.from(bindingMap.values());
}

async function handleExec(ws: AuthenticatedSocket, msg: any) {
  const { clusterId, namespace, podName, container } = msg;

  try {
    const clients = await getK8sClient(clusterId);
    const exec = new k8s.Exec(clients.kc);
    const { Writable } = await import('stream');

    const shellCmd = `TERM=xterm-256color; export TERM; export PS1='\\033[01;32mroot@${podName}\\033[00m:\\033[01;34m\\w\\033[00m\\$ '; [ -x /bin/bash ] && exec /bin/bash --norc || exec /bin/sh`;

    // Stdout/Stderr → forward to browser WebSocket
    const stdout = new Writable({
      write(chunk, _enc, cb) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exec-output', data: chunk.toString() }));
        }
        cb();
      },
    });

    const stderr = new Writable({
      write(chunk, _enc, cb) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exec-output', data: chunk.toString() }));
        }
        cb();
      },
    });

    // Stdin ← receives data from browser, passed to K8s exec
    const stdin = new PassThrough();

    const execConn = await exec.exec(
      namespace,
      podName,
      container || '',
      ['/bin/sh', '-c', shellCmd],
      stdout,
      stderr,
      stdin,
      true, // tty
      (status: k8s.V1Status) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exec-output', data: `\r\n\x1b[33m[Exit: ${status.status}]\x1b[0m\r\n` }));
        }
      },
    );

    // Forward browser keyboard input → stdin stream → K8s exec
    const messageHandler = (rawData: any) => {
      try {
        const parsed = JSON.parse(rawData.toString());
        if (parsed.type === 'exec-input') {
          stdin.write(parsed.data);
        }
      } catch {}
    };

    ws.on('message', messageHandler);

    if (execConn && typeof (execConn as any).on === 'function') {
      (execConn as any).on('close', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exec-output', data: '\r\n\x1b[33m[会话已结束]\x1b[0m\r\n' }));
        }
      });
    }

    ws.on('close', () => {
      ws.removeListener('message', messageHandler);
      stdin.end();
      stdout.destroy();
      stderr.destroy();
      try { if (execConn && typeof (execConn as any).close === 'function') (execConn as any).close(); } catch {}
    });

  } catch (err: any) {
    console.error('handleExec error:', err);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: `Exec 失败: ${err.message}` }));
    }
  }
}

async function handleMessage(ws: AuthenticatedSocket, msg: any) {
  const { type, clusterId, namespace, podName, container, resourceType } = msg;

  const resource = type === 'subscribe-logs' ? 'pods' : type === 'subscribe-exec' ? 'pods' : type === 'subscribe-events' ? 'events' : resourceType || 'pods';
  const action = type === 'subscribe-logs' ? 'logs' : type === 'subscribe-exec' ? 'exec' : 'get';

  if (!checkPermission(ws.bindings || [], { clusterId, namespace: namespace || '*', resource, action })) {
    ws.send(JSON.stringify({ type: 'error', message: '权限不足' }));
    return;
  }

  if (type === 'subscribe-exec') {
    await handleExec(ws, msg);
    return;
  }

  if (type === 'subscribe-logs') {
    try {
      const clients = await getK8sClient(clusterId);
      const logStream = new k8s.Log(clients.kc);
      const passThrough = new PassThrough();

      passThrough.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'log', data: chunk.toString() }));
        }
      });

      const abortController = await logStream.log(namespace, podName, container, passThrough, {
        follow: true,
        tailLines: 100,
      });

      ws.on('close', () => {
        abortController.abort();
        passThrough.destroy();
      });
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'error', message: `日志获取失败: ${err.message}` }));
    }
    return;
  }

  if (type === 'subscribe-events') {
    try {
      const clients = await getK8sClient(clusterId);
      const watch = new k8s.Watch(clients.kc);
      const path = namespace ? `/api/v1/namespaces/${namespace}/events` : '/api/v1/events';
      const watchReq = await watch.watch(path, {}, (phase, obj) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'event', phase, data: obj }));
        }
      }, (err) => {
        if (err && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: err.message }));
      });
      ws.on('close', () => watchReq.abort());
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }
}

async function runHealthChecks() {
  try {
    const allClusters = await db.select().from(clustersTable);
    for (const cluster of allClusters) {
      try {
        const clients = await getK8sClient(cluster.id);
        const versionApi = clients.kc.makeApiClient(k8s.VersionApi);
        await versionApi.getCode();
        await db.update(clustersTable).set({ status: 'connected', lastHealthCheckAt: new Date() }).where(eq(clustersTable.id, cluster.id));
      } catch {
        await db.update(clustersTable).set({ status: 'error', lastHealthCheckAt: new Date() }).where(eq(clustersTable.id, cluster.id));
        invalidateClient(cluster.id);
      }
    }
  } catch {
    // DB connection might not be ready yet
  }
}

export function startWsServer(httpServer?: import('http').Server) {
  if (started) return;
  started = true;

  // Attach to existing HTTP server or create standalone on WS_PORT
  const wss = httpServer
    ? new WebSocketServer({ server: httpServer, path: '/ws' })
    : new WebSocketServer({ port: parseInt(process.env.WS_PORT || '3001') });

  wss.on('connection', async (ws: AuthenticatedSocket, req) => {
    const url = new URL(req.url || '', `http://localhost:3000`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }

    const user = await authenticate(token);
    if (!user) {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.userId = user.id;
    ws.bindings = await loadUserBindings(user.id);

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, msg);
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    ws.on('close', () => clearInterval(heartbeat));
  });

  // Health checks every 60s
  setInterval(runHealthChecks, 60000);
  setTimeout(runHealthChecks, 5000); // Wait a bit for DB to be ready

  // Session cleanup every hour
  setInterval(async () => {
    try {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    } catch {}
  }, 60 * 60 * 1000);

  console.log(`WebSocket server started${httpServer ? ' (attached to HTTP server at /ws)' : ''}`);
}
