import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { SLA_POLICIES_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const settings = await tenantRepository.getTenantSettings()
  if (!settings.features?.includes('ALERT_SLA')) {
    return
  }
  const db = mongoDb.db()
  const collection = db.collection(SLA_POLICIES_COLLECTION(tenant.id))
  const cursor = collection.find({})
  for await (const slaPolicy of cursor) {
    await collection.updateOne(
      { _id: slaPolicy._id },
      {
        $set: {
          type: 'ALERT',
          policyConfiguration: {
            ...(slaPolicy.policyConfiguration ?? {}),
            statusDetails: {
              statuses:
                slaPolicy.policyConfiguration?.alertStatusDetails
                  ?.alertStatuses,
              statusesCount:
                slaPolicy.policyConfiguration?.alertStatusDetails
                  ?.alertStatusesCount,
            },
          },
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
