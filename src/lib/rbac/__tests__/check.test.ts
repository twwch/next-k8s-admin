import { describe, it, expect } from '@jest/globals';
import { checkPermission, type PermissionContext, type RoleBinding } from '../check';

describe('checkPermission', () => {
  const superAdminBindings: RoleBinding[] = [{
    roleId: 'r1', clusterId: null, namespace: null,
    permissions: [{ resource: '*', actions: ['*'] }],
  }];

  it('super-admin has access to everything', () => {
    expect(checkPermission(superAdminBindings, { clusterId: 'c1', namespace: 'default', resource: 'pods', action: 'delete' })).toBe(true);
  });

  it('cluster-scoped binding works', () => {
    const bindings: RoleBinding[] = [{
      roleId: 'r2', clusterId: 'c1', namespace: null,
      permissions: [{ resource: 'deployments', actions: ['get', 'list'] }],
    }];
    expect(checkPermission(bindings, { clusterId: 'c1', namespace: 'default', resource: 'deployments', action: 'get' })).toBe(true);
    expect(checkPermission(bindings, { clusterId: 'c2', namespace: 'default', resource: 'deployments', action: 'get' })).toBe(false);
    expect(checkPermission(bindings, { clusterId: 'c1', namespace: 'default', resource: 'deployments', action: 'delete' })).toBe(false);
  });

  it('namespace-scoped binding works', () => {
    const bindings: RoleBinding[] = [{
      roleId: 'r3', clusterId: 'c1', namespace: 'prod',
      permissions: [{ resource: 'pods', actions: ['get', 'list', 'logs'] }],
    }];
    expect(checkPermission(bindings, { clusterId: 'c1', namespace: 'prod', resource: 'pods', action: 'logs' })).toBe(true);
    expect(checkPermission(bindings, { clusterId: 'c1', namespace: 'staging', resource: 'pods', action: 'logs' })).toBe(false);
  });

  it('permissions are additive (union)', () => {
    const bindings: RoleBinding[] = [
      { roleId: 'r1', clusterId: 'c1', namespace: 'prod', permissions: [{ resource: 'pods', actions: ['get'] }] },
      { roleId: 'r2', clusterId: 'c1', namespace: null, permissions: [{ resource: 'pods', actions: ['list'] }] },
    ];
    expect(checkPermission(bindings, { clusterId: 'c1', namespace: 'prod', resource: 'pods', action: 'get' })).toBe(true);
    expect(checkPermission(bindings, { clusterId: 'c1', namespace: 'prod', resource: 'pods', action: 'list' })).toBe(true);
  });
});
