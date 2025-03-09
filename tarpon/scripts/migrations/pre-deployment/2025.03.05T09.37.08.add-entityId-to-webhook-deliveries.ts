import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { WEBHOOK_DELIVERY_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'

const EVENT_TYPE_TO_ENTITY_MAP = {
  CASE_CLOSED: (data: any) => data.caseId || null,
  CASE_OPENED: (data: any) => data.caseId || null,
  USER_STATE_UPDATED: (data: any) => data.userId || null,
  KYC_STATUS_UPDATED: (data: any) => data.userId || null,
  PEP_STATUS_UPDATED: (data: any) => data.userId || null,
  USER_TAGS_UPDATED: (data: any) => data.userId || null,
  CRA_RISK_LEVEL_UPDATED: (data: any) => data.userId || null,
  LIST_UPDATED: (data: any) => data.userId || null,
  ALERT_CLOSED: (data: any) => data.alertId || null,
  ALERT_OPENED: (data: any) => data.alertId || null,
  TRANSACTION_STATUS_UPDATED: (data: any) =>
    data.transactionId ||
    (data.transactionIds && data.transactionIds.length > 0
      ? data.transactionIds[0]
      : null),
} as const

function extractEntityId(webhookEvent: any): string | null {
  const { type, data } = webhookEvent
  const extractFn = EVENT_TYPE_TO_ENTITY_MAP[type]
  return extractFn ? extractFn(data) : null
}

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const collection = mongoDb
    .db()
    .collection(WEBHOOK_DELIVERY_COLLECTION(tenant.id))

  const cursor = collection.find({
    entityId: { $exists: false },
  })

  let count = 0
  for await (const doc of cursor) {
    if (doc.request?.body) {
      try {
        // Handle both cases where body might be a string or already an object
        const jsonBody =
          typeof doc.request.body === 'string'
            ? JSON.parse(doc.request.body)
            : doc.request.body

        const entityId = extractEntityId(jsonBody)

        if (entityId) {
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: { entityId },
            }
          )
          count++
        }
      } catch (error) {
        console.error(`Failed to process document ${doc._id}: ${error}`)
        continue
      }
    }
  }
  console.log(`Updated ${count} documents for tenant ${tenant.id}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
