import { GetOrganizationMemberRoles200ResponseOneOfInner } from 'auth0'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'

export function getNamespacedRoleName(namespace: string, roleName: string) {
  return `${namespace}:${roleName}`
}

export function getRoleDisplayName(roleName?: string) {
  if (!roleName) {
    return undefined
  }
  if (roleName === 'root' || roleName === 'whitelabel-root') {
    return roleName
  }
  const parts = roleName.split(':')
  return parts.length > 1 ? parts[1] : roleName
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

export interface PermissionConversionResult {
  statements: PermissionStatements[]
  permissions: Permission[]
}

// Sanitizes role names, preserving spaces and underscores
export function sanitizeRoleName(str: string, preserveSpaces = true) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string')
  }

  const sanitizePattern = preserveSpaces ? /[^a-zA-Z0-9_\s]/g : /[^a-zA-Z0-9_]/g //allow alphabets, numbers and underscores
  const processed = str.replace(sanitizePattern, '')
  if (preserveSpaces) {
    return processed.replace(/\s+/g, ' ').trim()
  } else {
    return processed.replace(/\s+/g, '')
  }
}
