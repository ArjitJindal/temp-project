import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'
import { AccountRole } from '../openapi-internal/AccountRole'

export const ROLES: AccountRole[] = ['root', 'admin', 'user']

export function isValidRole(role: string): role is AccountRole {
  return ROLES.indexOf(role as AccountRole) !== -1
}

export function assertRole(
  userInfo: {
    role: string
    verifiedEmail: string | undefined
  },
  requiredRole: AccountRole
) {
  const { role, verifiedEmail } = userInfo
  if (isValidRole(role) && ROLES.indexOf(role) > ROLES.indexOf(requiredRole)) {
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

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  principalId: string
  userId: string
  role: AccountRole
  tenantName: string
  verifiedEmail: string
}
