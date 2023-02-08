import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'
import { AccountRoleName } from '../openapi-internal/AccountRoleName'

export const ROLES: AccountRoleName[] = [
  'root',
  'admin',
  'user',
  'analyst',
  'approver',
  'auditor',
  'developer',
  'qa_analyst',
]

export function isValidRole(role: unknown): role is AccountRoleName {
  if (role == null || typeof role !== 'string') {
    return false
  }
  return ROLES.indexOf(role as AccountRoleName) !== -1
}

export function assertRole(
  userInfo: {
    role: string
    verifiedEmail: string | undefined
  },
  requiredRole: AccountRoleName
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
  role: AccountRoleName
  tenantName: string
  verifiedEmail: string
}
