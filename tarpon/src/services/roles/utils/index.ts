import { GetOrganizationMemberRoles200ResponseOneOfInner } from 'auth0'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'

export function getNamespacedRoleName(namespace: string, roleName: string) {
  return `${namespace}:${roleName}`
}

export function getRoleDisplayName(roleName?: string) {
  if (roleName == 'root') {
    return 'root'
  }
  if (roleName == 'whitelabel-root') {
    return 'whitelabel-root'
  }
  return roleName && roleName.split(':')[1]
}

export function isInNamespace(namespace: string, roleName?: string) {
  return roleName?.startsWith(`${namespace}:`)
}

export function getNamespace(namespace: string) {
  return namespace.split(':')[0]
}

export function transformRole(
  auth0Role: GetOrganizationMemberRoles200ResponseOneOfInner,
  permissions: Permission[],
  statements: PermissionStatements[]
): AccountRole {
  return {
    id: auth0Role.id,
    name: getRoleDisplayName(auth0Role.name) || 'No name',
    description: auth0Role.description,
    permissions,
    statements,
  }
}
