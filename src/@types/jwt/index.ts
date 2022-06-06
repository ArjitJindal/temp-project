import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'

export const JWT_ROLES = ['root', 'admin', 'user']
export type JwtRole = typeof JWT_ROLES[number]

export function isJwtRole(role: string): role is JwtRole {
  return JWT_ROLES.indexOf(role) !== -1
}

export function assertRole(userRole: JwtRole, requiredRole: JwtRole) {
  if (JWT_ROLES.indexOf(userRole) > JWT_ROLES.indexOf(requiredRole)) {
    throw new Forbidden(
      `You need to have at least "${requiredRole}" role to perform this action`
    )
  }
}

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  userId: string
  role: JwtRole
  tenantName: string
  tenantConsoleHost: string
}
