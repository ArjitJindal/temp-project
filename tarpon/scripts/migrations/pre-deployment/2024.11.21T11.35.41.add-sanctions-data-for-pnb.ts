import { migrateAllTenants } from '../utils/tenant'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { Tenant } from '@/services/accounts'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (envIs('prod') && tenant.id === 'pnb') {
    const repo = new MongoSanctionsRepository(tenant.id)
    const dowJonesFetcher = await DowJonesProvider.build(tenant.id)
    const version = Date.now().toString()
    await dowJonesFetcher.fullLoad(repo, version)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
