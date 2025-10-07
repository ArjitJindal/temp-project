import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { CounterEntity, EntityCounter } from '@/services/counter/repository'
import { COUNTER_COLLECTION } from '@/utils/mongo-table-names'
import { DynamoCounterRepository } from '@/services/counter/dynamo-repository'
import { logger } from '@/core/logger'
async function migrateTenant(tenant: Tenant) {
  if (isClickhouseEnabledInRegion()) {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const countersCollection = mongoDb
      .db()
      .collection<EntityCounter>(COUNTER_COLLECTION(tenant.id))
    const dynamoCounterRepository = new DynamoCounterRepository(
      tenant.id,
      dynamoDb
    )
    // processInCursorBatch is not required here because we are not dealing with a large number of items
    const entities = await countersCollection.find({}).toArray()
    // Edge case where we might have multiple entities (happened in demo data)
    const counters = new Map<string, number>()

    for (const { entity, count } of entities) {
      const current = counters.get(entity)
      if (current === undefined || count > current) {
        counters.set(entity, count)
      }
    }

    logger.info(`Setting ${entities.length} counters for tenant ${tenant.id}`)
    await dynamoCounterRepository.setCounters(
      Array.from(counters).map(([entity, count]) => ({
        entity: entity as CounterEntity,
        count,
      }))
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
