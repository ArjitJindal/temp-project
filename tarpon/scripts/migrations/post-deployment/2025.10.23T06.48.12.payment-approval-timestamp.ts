import { migrateAllTenants } from '../utils/tenant'
import {
  getMongoDbClient,
  internalMongoBulkUpdate,
  processCursorInBatch,
} from '@/utils/mongodb-utils'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { getContext } from '@/core/utils/context-storage'
import { logger } from '@/core/logger'
import { Tenant } from '@/@types/tenant'
import {
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongo-table-names'

// rerunning the original migration tarpon/scripts/migrations/post-deployment/2025.09.23T06.48.12.payment-approval-timestamp.ts

async function migrateTenant(tenant: Tenant) {
  const ctx = getContext()
  const tenantSetting = ctx?.settings
  const isPaymentApprovalEnabled = tenantSetting?.isPaymentApprovalEnabled
  if (isPaymentApprovalEnabled) {
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()

    const transactionEventCollection = db.collection<InternalTransactionEvent>(
      TRANSACTION_EVENTS_COLLECTION(tenant.id)
    )

    // Create temporary index on eventdescription
    await transactionEventCollection.createIndex(
      { eventDescription: -1, timestamp: -1 },
      { name: 'temp_eventDescription_timestamp_index' }
    )

    // pipeline to find most recent event for a transaction
    const transactionEventCursor = transactionEventCollection.aggregate<{
      _id: string // transactionId from group by stage
      timestamp: number
    }>([
      {
        $match: {
          timestamp: { $gte: 1756684800000 },
          eventDescription: {
            $regex: /^Transaction status was manually changed to\s/,
          },
        },
      },
      {
        $project: {
          transactionId: 1,
          timestamp: 1,
        },
      },
      {
        $group: {
          _id: '$transactionId',
          timestamp: { $max: '$timestamp' },
        },
      },
    ])

    await processCursorInBatch(
      transactionEventCursor,
      async (transactionEvents) => {
        // doing a batch write on these transactions
        logger.info(
          `Updating ${transactionEvents.length} transactions with payment approval dates`
        )
        await internalMongoBulkUpdate(
          mongoDb,
          TRANSACTIONS_COLLECTION(tenant.id),
          transactionEvents.map((transactionEvent) => {
            return {
              updateOne: {
                filter: { transactionId: transactionEvent._id },
                update: {
                  $set: {
                    paymentApprovalTimestamp: transactionEvent.timestamp,
                  },
                },
              },
            }
          })
        )
      },
      {
        mongoBatchSize: 5000,
        processBatchSize: 5000,
      }
    )

    // removing temporary index
    await transactionEventCollection.dropIndex(
      'temp_eventDescription_timestamp_index'
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
