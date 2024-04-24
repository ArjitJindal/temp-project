import { config } from '@flagright/lib/config/config-dev'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { AccountsService } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export async function syncAccountsLocally() {
  const auth0Domain = config.application.AUTH0_DOMAIN
  const mongoDb = await getMongoDbClient()

  const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
  const tenant = await accountsService.getTenantById(FLAGRIGHT_TENANT_ID)
  if (!tenant) {
    throw new Error(`Tenant with id ${FLAGRIGHT_TENANT_ID} not found`)
  }
  const tenantAccounts = await accountsService.getTenantAccounts(tenant)

  await accountsService.insertAuth0UserToMongo(
    FLAGRIGHT_TENANT_ID,
    tenantAccounts
  )
}
