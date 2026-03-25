import { db } from '@/lib/db';
import { userRoleBindings, rolePermissions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface Permission { resource: string; actions: string[]; }
export interface RoleBinding {
  roleId: string; clusterId: string | null; namespace: string | null;
  permissions: Permission[];
}
export interface PermissionContext {
  clusterId: string; namespace: string; resource: string; action: string;
}

function bindingMatchesContext(binding: RoleBinding, ctx: PermissionContext): boolean {
  if (binding.clusterId === null) return true;
  if (binding.clusterId !== ctx.clusterId) return false;
  if (binding.namespace === null) return true;
  return binding.namespace === ctx.namespace;
}

export function checkPermission(bindings: RoleBinding[], ctx: PermissionContext): boolean {
  const matchingPermissions: Permission[] = [];
  for (const binding of bindings) {
    if (bindingMatchesContext(binding, ctx)) {
      matchingPermissions.push(...binding.permissions);
    }
  }
  for (const perm of matchingPermissions) {
    const resourceMatch = perm.resource === '*' || perm.resource === ctx.resource;
    const actionMatch = perm.actions.includes('*') || perm.actions.includes(ctx.action);
    if (resourceMatch && actionMatch) return true;
  }
  return false;
}

export async function getUserBindings(userId: string): Promise<RoleBinding[]> {
  const bindings = await db
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
  for (const row of bindings) {
    const key = `${row.roleId}:${row.clusterId}:${row.namespace}`;
    if (!bindingMap.has(key)) {
      bindingMap.set(key, {
        roleId: row.roleId, clusterId: row.clusterId, namespace: row.namespace, permissions: [],
      });
    }
    bindingMap.get(key)!.permissions.push({ resource: row.resource, actions: row.actions as string[] });
  }
  return Array.from(bindingMap.values());
}
