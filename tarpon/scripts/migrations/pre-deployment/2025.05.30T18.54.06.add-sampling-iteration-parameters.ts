import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { SIMULATION_TASK_COLLECTION } from '@/utils/mongodb-definitions'
import { V8RiskSimulationJob } from '@/@types/openapi-internal/V8RiskSimulationJob'
import { SimulationV8RiskFactorsIteration } from '@/@types/openapi-internal/SimulationV8RiskFactorsIteration'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const taskCollection = mongoDb
    .db()
    .collection(SIMULATION_TASK_COLLECTION(tenant.id))
  const v8RiskTaskCursor = taskCollection.find<V8RiskSimulationJob>({
    type: 'RISK_FACTORS_V8',
  })
  for await (const taskData of v8RiskTaskCursor) {
    const iterations = taskData.iterations.map(
      (iteration: SimulationV8RiskFactorsIteration) => ({
        ...iteration,
        parameters: {
          ...iteration.parameters,
          sampling: {
            sample: {
              type: 'ALL',
            },
          },
        },
      })
    )
    await taskCollection.updateOne(
      { jobId: taskData.jobId },
      {
        $set: {
          iterations: iterations,
        },
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
