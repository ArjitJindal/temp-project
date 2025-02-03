import { PostOrganizationsRequest } from 'auth0'
import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import { Account } from '@/@types/openapi-internal/Account'
import { AccountPatchPayload } from '@/@types/openapi-internal/AccountPatchPayload'
import { traceable } from '@/core/xray'

export type Tenant = {
  id: string
  name: string
  orgId: string
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
}

@traceable
export abstract class BaseAccountsRepository {
  abstract getAccount(accountId: string): Promise<Account | null>
  abstract getAccountByEmail(email: string): Promise<Account | null>
  abstract getAccountTenant(accountId: string): Promise<Tenant | null>
  abstract getOrganization(
    tenantId: string,
    userId?: string
  ): Promise<Tenant | null>
  abstract deleteOrganization(tenant: Tenant): Promise<void>
  abstract patchAccount(
    tenantId: string,
    accountId: string,
    patchData: PatchAccountData
  ): Promise<Account>
  abstract createAccount(
    tenantId: string,
    createParams: InternalAccountCreate
  ): Promise<Account>
  abstract unblockAccount(tenantId: string, accountId: string): Promise<Account>
  abstract getTenantAccounts(tenant: Tenant): Promise<Account[]>
  abstract getAccountByIds(accountIds: string[]): Promise<Account[]>
  abstract createOrganization(
    tenantId: string,
    createParams: InternalOrganizationCreate
  ): Promise<Tenant>
  abstract patchOrganization(
    tenantId: string,
    patch: Partial<Auth0TenantMetadata>
  ): Promise<Tenant>
  abstract addAccountToOrganization(
    tenant: Tenant,
    account: Account
  ): Promise<void>
  abstract deleteAccountFromOrganization(
    tenant: Tenant,
    account: Account
  ): Promise<void>
  abstract deleteAccount(account: Account): Promise<void>
  abstract getTenants(auth0Domain?: string): Promise<Tenant[]>
  abstract getTenantById(tenantId: string): Promise<Tenant | null>
}
