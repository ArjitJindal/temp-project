import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { GlobalRuleAggregationRebuildBatchJob } from '@/@types/batch-job'
import { sendBatchJobCommand } from '@/services/batch-job'
import { UserRepository } from '@/services/users/repositories/user-repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const userRepository = new UserRepository(tenant.id, { mongoDb })

  for await (const user of await userRepository.getAllUserIdsCursor()) {
    const batchJob: GlobalRuleAggregationRebuildBatchJob = {
      type: 'GLOBAL_RULE_AGGREGATION_REBUILD',
      tenantId: tenant.id,
      parameters: {
        userId: user.userId,
        aggregatorName: 'UserTransactionStatsTimeGroup',
      },
    }
    await sendBatchJobCommand(tenant.id, batchJob)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
