import { Account } from '@/@types/openapi-internal/Account'
import { traceable } from '@/core/xray'
import {
  Tenant,
  MicroTenantInfo,
  PatchAccountData,
  InternalAccountCreate,
  InternalOrganizationCreate,
  Auth0TenantMetadata,
} from '@/@types/tenant'

@traceable
export abstract class BaseAccountsRepository {
  abstract getAccount(accountId: string): Promise<Account | null>
  abstract getAccountByEmail(email: string): Promise<Account | null>
  abstract getAccountTenant(accountId: string): Promise<Tenant | null>
  abstract getOrganization(tenantId: string): Promise<Tenant | null>
  abstract deleteOrganization(tenant: Tenant): Promise<void>
  abstract patchAccount(
    tenantInfo: MicroTenantInfo,
    accountId: string,
    patchData: PatchAccountData
  ): Promise<Account>
  abstract createAccount(
    tenantInfo: MicroTenantInfo,
    createParams: InternalAccountCreate
  ): Promise<Account>
  abstract unblockAccount(
    tenantInfo: MicroTenantInfo,
    accountId: string
  ): Promise<Account>
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
