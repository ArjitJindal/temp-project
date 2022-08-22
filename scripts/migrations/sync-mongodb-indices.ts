import { exit } from 'process'
import { TarponStackConstants } from '@cdk/constants'
import { getMongoDbClient } from './utils/db'
import { getConfig } from './utils/config'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'
import {
  AccountsService,
  Tenant,
} from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { createMongoDBCollections } from '@/lambdas/api-key-generator/app'

const config = getConfig()

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(
    TarponStackConstants.MONGO_DB_DATABASE_NAME
  )
  await createMongoDBCollections(mongodb, tenant.id)
  console.info(`MongoDB indices synced for tenant: ${tenant.id}`)
}

async function main() {
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const tenants = await accountsService.getTenants()
  for (const tenant of tenants) {
    await migrateTenant(tenant)
  }
}

main()
  .then(() => {
    console.info('Completed.')
    exit(0)
  })
  .catch((e) => {
    console.error(e)
    exit(1)
  })
