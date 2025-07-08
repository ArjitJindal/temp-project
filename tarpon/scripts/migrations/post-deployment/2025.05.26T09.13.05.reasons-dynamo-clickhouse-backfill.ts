import { migrateAllTenants } from '../utils/tenant'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'
import { isDemoTenant } from '@/utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { REASONS_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts/repository'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { DynamoReasonsRepository } from '@/services/tenants/repositories/reasons/dynamo-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    return
  }

  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const reasonsDynamoRepository = new DynamoReasonsRepository(
    tenant.id,
    dynamoDb
  )
  const reasonsCollection = mongoDb
    .db()
    .collection<ConsoleActionReason>(REASONS_COLLECTION(tenant.id))
  await processCursorInBatch(
    reasonsCollection.find({}),
    async (reasons) => {
      await reasonsDynamoRepository.saveReasons(reasons)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
