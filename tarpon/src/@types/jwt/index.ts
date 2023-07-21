import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'
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

export function assertCurrentUserRole(requiredRole: ManagedRoleName) {
  assertRole(currentUser(), requiredRole)
}

export function assertRole(user: ContextUser, requiredRole: ManagedRoleName) {
  if (!user) {
    throw new Forbidden('Unknown user')
  }

  const { role, email } = user
  if (
    !isValidManagedRoleName(role) ||
    MANAGED_ROLE_NAMES.indexOf(role) > MANAGED_ROLE_NAMES.indexOf(requiredRole)
  ) {
    throw new Forbidden(
      `You need to have at least "${requiredRole}" role to perform this action`
    )
  }

  const isFlagrightEmail = email != null && email.endsWith('@flagright.com')
  if (role === 'root' && !isFlagrightEmail) {
    throw new Forbidden(`Root users should have email in Flagright domain`)
  }
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

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  principalId: string
  userId: string
  role: string
  tenantId: string
  tenantName: string
  encodedPermissions: string
  verifiedEmail: string
  auth0Domain: string
}
