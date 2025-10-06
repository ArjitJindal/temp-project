import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import type { PostOrganizationsRequest } from 'auth0'
import type { Account } from '@/@types/openapi-internal/Account'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'

export type TenantBasic = {
  id: string
  name: string
  auth0Domain?: string
}

export type Tenant = {
  id: string
  name: string
  orgId: string
  orgName: string
  apiAudience: string
  region: string
  isProductionAccessDisabled: boolean
  tenantCreatedAt: string
  consoleApiUrl: string
  auth0Domain: string
}

export type InternalUserCreate = {
  email: string
  role: string
  isReviewer?: boolean
  isReviewRequired?: boolean
  reviewerId?: string
  escalationLevel?: string
  escalationReviewerId?: string
  name?: string
  staffId?: string
  department?: string
  tenantName: string
  tenantId: string
}

export type InternalAccountCreate =
  | { type: 'AUTH0'; params: InternalUserCreate }
  | { type: 'DATABASE'; params: Account }

export type InternalOrganizationCreate =
  | { type: 'DATABASE'; params: Tenant }
  | { type: 'AUTH0'; params: PostOrganizationsRequest }

export type Auth0TenantMetadata = {
  tenantId: string
  consoleApiUrl: string
  apiAudience: string
  auth0Domain: string
  region: FlagrightRegion
  isProductionAccessDisabled: boolean
  tenantCreatedAt: string
  mfaEnabled: boolean
  passwordResetDays: number
  orgName: string
}
/**
 * This Base Class ensures that we need all these methods to be implemented if we are
 * Integrating a new Accounts Management System or a new Cache Management System
 */

export type PatchAccountData = {
  blocked?: boolean
  app_metadata?: Omit<AccountPatchPayload, 'demoMode'>
  user_metadata?: { demoMode?: boolean }
  blockedReason?: Account['blockedReason'] | null
  role?: string
  name?: string
  staffId?: string
  department?: string
}

export type MicroTenantInfo = {
  tenantId: string
  orgName: string
}
