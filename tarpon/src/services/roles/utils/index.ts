import { GetOrganizationMemberRoles200ResponseOneOfInner } from 'auth0'
import { uniq } from 'lodash'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
import { hasFeature } from '@/core/utils/context'
import {
  convertV1PermissionToV2,
  convertV2PermissionToV1,
  getOptimizedPermissions,
} from '@/services/rbac/utils/permissions'

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

export interface PermissionConversionResult {
  statements: PermissionStatements[]
  permissions: Permission[]
}

/**
 * Converts between v1 permissions and v2 statements based on RBAC_V2 feature flag
 * @param tenantId The tenant ID
 * @param inputPermissions Optional v1 permissions to convert
 * @param inputStatements Optional v2 statements to convert
 * @returns Object containing both v1 permissions and v2 statements
 */
export function convertPermissions(
  tenantId: string,
  inputPermissions?: Permission[],
  inputStatements?: PermissionStatements[]
): PermissionConversionResult {
  const isRbacV2Enabled = hasFeature('RBAC_V2')

  let statements: PermissionStatements[] = []
  let permissions: Permission[] = []

  if (isRbacV2Enabled) {
    const v1Permissions = convertV2PermissionToV1(
      tenantId,
      inputStatements ?? []
    )
    statements = getOptimizedPermissions(tenantId, inputStatements ?? [])
    permissions = uniq(v1Permissions.concat(inputPermissions ?? []))
  } else {
    const v2Statements = convertV1PermissionToV2(
      tenantId,
      inputPermissions ?? []
    )
    statements = getOptimizedPermissions(
      tenantId,
      (inputStatements ?? []).concat(v2Statements)
    )
    permissions = uniq(inputPermissions ?? [])
  }

  return { statements, permissions }
}
