import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'
import { AccountRoleName } from '../openapi-internal/AccountRoleName'
import { Permission } from '@/@types/openapi-internal/Permission'
import { getContext } from '@/core/utils/context'
import {
  ACCOUNT_ROLE_NAMES,
  isValidAccountRoleName,
} from '@/@types/openapi-internal-custom/AccountRoleName'

export function assertRole(
  userInfo: {
    role: string
    verifiedEmail: string | undefined
  },
  requiredRole: AccountRoleName
) {
  const { role, verifiedEmail } = userInfo
  if (
    isValidAccountRoleName(role) &&
    ACCOUNT_ROLE_NAMES.indexOf(role) > ACCOUNT_ROLE_NAMES.indexOf(requiredRole)
  ) {
    throw new Forbidden(
      `You need to have at least "${requiredRole}" role to perform this action`
    )
  }

  const isFlagrightEmail =
    verifiedEmail != null && verifiedEmail.endsWith('@flagright.com')
  if (role === 'root' && !isFlagrightEmail) {
    throw new Forbidden(`Root users should have email in Flagright domain`)
  }
}

export function assertPermissions(requiredPermissions: Permission[]) {
  const context = getContext()

  // Check feature flag
  const rbacEnabled = getContext()?.features?.indexOf('RBAC')
  if (rbacEnabled == undefined || rbacEnabled < 0) {
    return
  }

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
  role: AccountRoleName
  tenantId: string
  tenantName: string
  encodedPermissions: string
  verifiedEmail: string
  auth0Domain: string
}
