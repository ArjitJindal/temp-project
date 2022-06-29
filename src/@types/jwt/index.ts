import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'
import { AccountRole } from '../openapi-internal/AccountRole'

export const ROLES: AccountRole[] = ['root', 'admin', 'user']

export function isValidRole(role: AccountRole): role is AccountRole {
  return ROLES.indexOf(role) !== -1
}

export function assertRole(userRole: string, requiredRole: AccountRole) {
  if (ROLES.indexOf(userRole as AccountRole) > ROLES.indexOf(requiredRole)) {
    throw new Forbidden(
      `You need to have at least "${requiredRole}" role to perform this action`
    )
  }
}

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  userId: string
  role: AccountRole
  tenantName: string
  tenantConsoleHost: string
}
