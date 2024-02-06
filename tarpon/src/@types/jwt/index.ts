import { Forbidden } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { ManagedRoleName } from '../openapi-internal/ManagedRoleName'
import { Permission } from '@/@types/openapi-internal/Permission'
import { ContextUser, currentUser, getContext } from '@/core/utils/context'
import {
  MANAGED_ROLE_NAMES,
  isValidManagedRoleName,
} from '@/@types/openapi-internal-custom/ManagedRoleName'

export function isRoleAboveAdmin(role: string) {
  return isAbove(role, 'admin')
}

export function isCurrentUserAtLeastRole(requiredRole: ManagedRoleName) {
  return isAtLeastRole(currentUser(), requiredRole)
}

export function isAtLeastRole(
  user: ContextUser,
  requiredRole: ManagedRoleName
) {
  try {
    assertRole(user, requiredRole)
  } catch (e) {
    if (e instanceof Forbidden) {
      return false
    }
  }
  return true
}

export function assertCurrentUserRoleAboveAdmin() {
  return assertCurrentUserRole(
    ...MANAGED_ROLE_NAMES.slice(0, MANAGED_ROLE_NAMES.indexOf('admin'))
  )
}

export function assertCurrentUserRole(...requiredRoles: ManagedRoleName[]) {
  let hasRole = false
  requiredRoles.forEach((requiredRole) => {
    try {
      assertRole(currentUser(), requiredRole)
      hasRole = true
      return
    } catch (e) {
      // Do nothing
      return
    }
  })
  if (!hasRole) {
    throw new Error(
      `You need to have one of the following roles to perform this action: ${requiredRoles.join(
        ', '
      )}`
    )
  }
}

function isAbove(role1: string, role2: string) {
  return (
    MANAGED_ROLE_NAMES.indexOf(role1 as ManagedRoleName) <
    MANAGED_ROLE_NAMES.indexOf(role2 as ManagedRoleName)
  )
}

function isAtLeast(role1: string, role2: string) {
  return (
    MANAGED_ROLE_NAMES.indexOf(role1 as ManagedRoleName) <=
    MANAGED_ROLE_NAMES.indexOf(role2 as ManagedRoleName)
  )
}

export const assertHasDangerousTenantDelete = () => {
  const user = currentUser()
  if (!user) {
    throw new Forbidden('Unknown user')
  }

  if (!user.allowTenantDeletion) {
    throw new Forbidden(
      `You need to have allowTenantDeletion flag to perform this action`
    )
  }
}

export function assertRole(user: ContextUser, requiredRole: ManagedRoleName) {
  if (!user) {
    throw new Forbidden('Unknown user')
  }

  const { role } = user
  if (!isValidManagedRoleName(role) || !isAtLeast(role, requiredRole)) {
    throw new Forbidden(
      `You need to have at least "${requiredRole}" role to perform this action`
    )
  }

  if (role === 'root' && !isFlagrightInternalUser()) {
    throw new Forbidden(`Root users should have email in Flagright domain`)
  }
}

export function isFlagrightInternalUser() {
  const user = currentUser()
  return user?.email?.endsWith('@flagright.com')
}

export function assertPermissions(requiredPermissions: Permission[]) {
  const context = getContext()

  // If user is root, ignore RBAC.
  if (context?.user?.role === 'root') {
    return
  }

  if (requiredPermissions !== undefined) {
    const missingPermissions = requiredPermissions.filter(
      (p) => context?.authz?.permissions && !context?.authz?.permissions.has(p)
    )

    if (missingPermissions.length > 0) {
      throw new Forbidden(
        `Missing required permissions to perform this action: ${missingPermissions.join(
          ', '
        )}`
      )
    }
    return
  }
}

export interface JWTAuthorizerResult extends Credentials {
  principalId: string
  userId: string
  role: string
  tenantId: string
  tenantName: string
  encodedPermissions: string
  verifiedEmail: string
  auth0Domain: string
  allowTenantDeletion: boolean
}
