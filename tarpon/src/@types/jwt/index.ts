import { Forbidden } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { ManagedRoleName } from '../openapi-internal/ManagedRoleName'
import { Permission } from '@/@types/openapi-internal/Permission'
import { ContextUser, currentUser, getContext } from '@/core/utils/context'
import {
  MANAGED_ROLE_NAMES,
  isValidManagedRoleName,
} from '@/@types/openapi-internal-custom/ManagedRoleName'

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

export function assertRole(user: ContextUser, requiredRole: ManagedRoleName) {
  if (!user) {
    throw new Forbidden('Unknown user')
  }

  const { role } = user
  if (
    !isValidManagedRoleName(role) ||
    MANAGED_ROLE_NAMES.indexOf(role) > MANAGED_ROLE_NAMES.indexOf(requiredRole)
  ) {
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

  // should have at least one permission among the required ones

  if (!requiredPermissions?.length) {
    return
  }

  const userPermissions = context?.authz?.permissions

  const hasPermission = requiredPermissions.some((requiredPermission) =>
    userPermissions?.has(requiredPermission)
  )
  if (!hasPermission) {
    throw new Forbidden(
      `You need to have at least one of the following permissions to perform this action: ${requiredPermissions.join(
        ', '
      )}`
    )
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
}
