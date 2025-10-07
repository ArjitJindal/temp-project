import { WithId } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import { Case } from '@/@types/openapi-internal/Case'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Comment } from '@/@types/openapi-internal/Comment'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const caseCollection = db.collection<Case>(CASES_COLLECTION(tenantId))

  const casesCursor = caseCollection.find({
    alerts: {
      $elemMatch: {
        $or: [
          { statusChanges: { $exists: false } },
          { statusChanges: { $size: 0 } },
        ],
        alertStatus: { $ne: 'OPEN' },
      },
    },
  })

  await processCursorInBatch(
    casesCursor,
    async (batch) => {
      for (const case_ of batch) {
        const alerts = case_.alerts || []

        // Process each alert that needs updating
        for (let i = 0; i < alerts.length; i++) {
          const alert = alerts[i]
          if (
            (alert.statusChanges && alert.statusChanges.length > 0) ||
            alert.alertStatus === 'OPEN'
          ) {
            continue
          }

          const statusChange: CaseStatusChange = {
            userId: FLAGRIGHT_SYSTEM_USER,
            reason: ['Other'],
            timestamp: alert.createdTimestamp,
            caseStatus: alert.alertStatus,
            otherReason: 'Status set by rule',
            comment: `Alert default status set to '${alert.alertStatus}' by rule configuration`,
          }

          const comment: Comment = {
            body: statusChange.comment as string,
            createdAt: alert.createdTimestamp,
            userId: FLAGRIGHT_SYSTEM_USER,
          }

          // Update the specific alert in the array using array operators
          await caseCollection.updateOne(
            {
              _id: (case_ as WithId<Case>)._id,
            },
            {
              $set: {
                [`alerts.${i}.lastStatusChange`]: statusChange,
                [`alerts.${i}.statusChanges`]: [statusChange],
              },
              $push: {
                [`alerts.${i}.comments`]: comment,
              },
            }
          )
        }
      }
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 200,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
