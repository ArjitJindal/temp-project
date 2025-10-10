import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { ReasonsService } from '@/services/tenants/reasons-service'
import { logger } from '@/core/logger'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === '46fe6f381c') {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const reasonsService = new ReasonsService(tenant.id, {
      mongoDb,
      dynamoDb,
    })
    await reasonsService.initialiseDefaultReasons()
    logger.info(`Stored default reasons for tenant ${tenant.name} `)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
