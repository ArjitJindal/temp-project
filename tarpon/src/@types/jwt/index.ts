import { Forbidden } from 'http-errors'
import { Credentials } from '@aws-sdk/client-sts'
import { ManagedRoleName } from '../openapi-internal/ManagedRoleName'
import { PermissionsAction } from '../openapi-internal/PermissionsAction'
import { Permission } from '@/@types/openapi-internal/Permission'
import { ContextUser, currentUser } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import {
  MANAGED_ROLE_NAMES,
  isValidManagedRoleName,
} from '@/@types/openapi-internal-custom/ManagedRoleName'
import { envIsNot } from '@/utils/env'

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

export function assertProductionAccess() {
  const settings = getContext()?.settings
  const user = currentUser()

  if (envIsNot('prod')) {
    return
  }

  // Explicitly check for false, as undefined means tenantSettings it is available
  if (settings?.isProductionAccessEnabled === false && user?.role === 'root') {
    throw new Forbidden('Production access is disabled')
  }
}

export function assertAllowAccessTenant() {
  const user = currentUser()

  if (envIsNot('prod')) {
    return
  }

  if (!user) {
    throw new Forbidden('Unknown user')
  }

  const currentRegion = process.env.REGION as string

  if (!user?.allowedRegions?.length) {
    return
  }

  if (!user?.allowedRegions?.includes(currentRegion)) {
    throw new Forbidden(
      `You need to have access to ${currentRegion} to perform this action`
    )
  }
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
    assertAllowAccessTenant()
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

export function assertResourceAccess(requiredResources: string[]) {
  const context = getContext()
  if (!context) {
    throw new Forbidden('Unknown user')
  }
  const statements = context.statements

  if (context.user?.role === 'root') {
    assertAllowAccessTenant()
    return
  }

  for (const requiredResource of requiredResources) {
    const [action, resource] = requiredResource.split(':::')
    let hasAccess = false // Deny by default

    const statementsForAction =
      statements?.filter((s) =>
        s.actions.includes(action as PermissionsAction)
      ) ?? []

    for (const statement of statementsForAction) {
      for (const statementResource of statement.resources) {
        const [_, resourcePath] = statementResource.split(':::')

        if (resourcePath === '*' || resource.startsWith(resourcePath)) {
          hasAccess = true
          break
        }
      }
      if (hasAccess) {
        break
      }
    }

    if (!hasAccess) {
      throw new Forbidden(`Missing required resource: ${requiredResource}`)
    }
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
  encodedAllowedRegions: string
}
