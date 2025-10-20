import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { ReasonsService } from '@/services/tenants/reasons-service'
import { COUNTER_COLLECTION } from '@/utils/mongo-table-names'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const reasonsService = new ReasonsService(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const reasons = await reasonsService.getReasons()
  const { closureReasonCount, escalationReasonCount } = reasons.reduce(
    (prev, curr) => {
      if (curr.reasonType === 'CLOSURE') {
        prev.closureReasonCount++
      } else {
        prev.escalationReasonCount++
      }
      return prev
    },
    { closureReasonCount: 0, escalationReasonCount: 0 }
  )
  const counterCollection = mongoDb
    .db()
    .collection(COUNTER_COLLECTION(tenant.id))
  await Promise.all([
    counterCollection.updateOne(
      { entity: 'ClosureReason' },
      { $set: { count: closureReasonCount } }
    ),
    counterCollection.updateOne(
      { entity: 'EscalationReason' },
      { $set: { count: escalationReasonCount } }
    ),
  ])
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
