import { memoize } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SIMULATION_TASK_COLLECTION } from '@/utils/mongodb-definitions'
import { AccountsService, Tenant } from '@/services/accounts'
import { SimulationPulseJob } from '@/@types/openapi-internal/SimulationPulseJob'
import { SimulationBeaconJob } from '@/@types/openapi-internal/SimulationBeaconJob'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService({ auth0Domain }, { mongoDb })
  const getAccount = memoize(async (accountId: string) => {
    return accountsService.getAccount(accountId)
  })

  const db = mongoDb.db()
  const collection = db.collection<SimulationPulseJob | SimulationBeaconJob>(
    SIMULATION_TASK_COLLECTION(tenant.id)
  )
  const targetSimulationIds = []
  for await (const simulation of collection.find({})) {
    const user = await getAccount(simulation.createdBy)
    if (user.role === 'root') {
      targetSimulationIds.push(simulation._id)
    }
  }
  if (targetSimulationIds.length > 0) {
    await collection.updateMany(
      { _id: { $in: targetSimulationIds } },
      {
        $set: {
          internal: true,
        },
      }
    )
    logger.info(
      `Updated ${targetSimulationIds.length} simulation jobs to be internal`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
