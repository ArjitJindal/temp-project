import { last } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { migrateEntities } from '../utils/mongodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { GlobalRuleAggregationRebuildBatchJob } from '@/@types/batch-job'
import { sendBatchJobCommand } from '@/services/batch-job'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const usersCollection = db.collection<InternalUser>(
    USERS_COLLECTION(tenant.id)
  )
  const migrationKey = `2023.06.12T23.06.10.rebuild-aggregation-${tenant.id}`
  const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
    migrationKey
  )
  const cursor = usersCollection
    .find({
      createdTimestamp: { $gt: lastCompletedTimestamp ?? 0 },
    })
    .sort({ createdTimestamp: 1 })
    .maxTimeMS(60 * 60 * 1000) // 1 hour

  await migrateEntities<InternalUser>(cursor, async (usersBatch) => {
    for (const user of usersBatch) {
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
    await updateMigrationLastCompletedTimestamp(
      migrationKey,
      last(usersBatch)?.createdTimestamp ?? 0
    )
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
