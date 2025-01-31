import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { compact } from 'lodash'
import { setAccounts } from './samplers/accounts'
import { AccountsService } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getNonDemoTenantId } from '@/utils/tenant'
import { logger } from '@/core/logger'

export async function fetchAndSetAccounts(
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
): Promise<void> {
  const originalTenantId = getNonDemoTenantId(tenantId)
  const tenantRepository = new TenantRepository(originalTenantId, {
    dynamoDb,
  })
  const settings = await tenantRepository.getTenantSettings(['auth0Domain'])
  const auth0Domain =
    settings.auth0Domain || (process.env.AUTH0_DOMAIN as string)
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
}
