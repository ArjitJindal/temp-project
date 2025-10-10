import { migrateAllTenants } from '../utils/tenant'
import { hasFeature } from '@/core/utils/context'
import { CounterRepository } from '@/services/counter/repository'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('SANCTIONS')) {
    const client = await getMongoDbClient()
    const counterRepository = new CounterRepository(tenant.id, {
      mongoDb: client,
      dynamoDb: getDynamoDbClient(),
    })
    await counterRepository.setCounterValue('ScreeningDetails', 100000000)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
