import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import compact from 'lodash/compact'
import { setAccounts } from './samplers/accounts'
import { AccountsService } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getNonDemoTenantId } from '@/utils/tenant'
import { logger } from '@/core/logger'
import { Account } from '@/@types/openapi-internal/Account'
import { RoleService } from '@/services/roles'

async function getTenantConfig(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
) {
  const originalTenantId = getNonDemoTenantId(tenantId)
  const tenantRepository = new TenantRepository(originalTenantId, {
    dynamoDb,
  })
  const settings = await tenantRepository.getTenantSettings(['auth0Domain'])
  const auth0Domain =
    settings.auth0Domain || (process.env.AUTH0_DOMAIN as string)

  return { originalTenantId, auth0Domain }
}

export async function fetchAndSetAccounts(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
): Promise<Account[]> {
  const { originalTenantId, auth0Domain } = await getTenantConfig(
    tenantId,
    dynamoDb
  )
  const accountsService = new AccountsService({ auth0Domain }, { dynamoDb })

  logger.info(`TenantId: ${tenantId}`)

  let tenant = await accountsService.getTenantById(originalTenantId)
  logger.info(`Tenant: ${JSON.stringify(tenant)}`)

  if (tenant == null) {
    tenant = await accountsService.getTenantById(tenantId)
  }

  const allAccounts =
    tenant != null ? await accountsService.getTenantAccounts(tenant) : []

  const accounts = compact(allAccounts).filter(
    (account) => account.role !== 'root' && !account.blocked
  )

  logger.info(`Accounts: ${JSON.stringify(accounts.map((a) => a.email))}`)
  setAccounts(accounts)

  return allAccounts
}

export async function syncAccountAndRoles(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
) {
  const { originalTenantId, auth0Domain } = await getTenantConfig(
    tenantId,
    dynamoDb
  )
  const accountsService = new AccountsService({ auth0Domain }, { dynamoDb })
  const roleService = new RoleService({ auth0Domain }, { dynamoDb })

  const tenant = await accountsService.getTenantById(originalTenantId)
  if (tenant) {
    logger.info(`Syncing ${originalTenantId} accounts and roles`)
    await accountsService.syncTenantAccounts(tenant)
    await roleService.syncTenantRoles(tenant)
  }
}
