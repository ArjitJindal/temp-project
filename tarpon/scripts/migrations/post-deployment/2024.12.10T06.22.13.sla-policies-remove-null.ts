import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
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
    if (slaPolicy.policyConfiguration?.statusDetails?.statusesCount === null) {
      await collection.updateOne(
        { _id: slaPolicy._id },
        {
          $set: {
            policyConfiguration: {
              ...(slaPolicy.policyConfiguration ?? {}),
              statusDetails: {
                statuses: slaPolicy.policyConfiguration.statusDetails.statuses,
              },
            },
          },
        }
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
