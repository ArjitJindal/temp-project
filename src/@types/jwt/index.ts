import * as AWS from 'aws-sdk'
import { Forbidden } from 'http-errors'

export const JWT_ROLES = ['root', 'user', 'admin']
export type JwtRole = typeof JWT_ROLES[number]

export function isJwtRole(role: string): role is JwtRole {
  return JWT_ROLES.indexOf(role) !== -1
}

export function assertRole(userRole: JwtRole, requiredRole: JwtRole) {
  if (userRole !== requiredRole) {
    throw new Forbidden(
      `You need to have "${requiredRole}" role to perform this action`
    )
  }
}

export interface JWTAuthorizerResult extends AWS.STS.Credentials {
  userId: string
  role: JwtRole
  tenantName: string
}
