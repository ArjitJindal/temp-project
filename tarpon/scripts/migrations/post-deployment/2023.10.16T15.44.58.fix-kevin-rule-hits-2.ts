import { compact, flatten, uniq } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { migrateEntities } from '../utils/mongodb'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { logger } from '@/core/logger'

const targetRuleInstanceIds = ['d9487625', '51178859']
const targetStart = 1693833998552
const targetEnd = 1694624623835

// Follow-up of 2023.09.13T15.44.58.fix-kevin-rule-hits.ts
async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'QEO03JYKBT') {
    return
  }

  const db = await getMongoDbClientDb()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cursor = await casesCollection
    .find(
      {
        caseStatus: { $ne: 'CLOSED' },
        'alerts.ruleInstanceId': { $in: targetRuleInstanceIds },
        'caseTransactions.createdAt': {
          $gte: targetStart,
          $lte: targetEnd,
        },
      },
      { timeout: false }
    )
    .sort({ createdTimestamp: 1 })
    .allowDiskUse()

  await migrateEntities<Case>(
    cursor,
    async (cases) => {
      for (const c of cases) {
        const alerts = (c.alerts ?? [])
          .map((alert) =>
            targetRuleInstanceIds.includes(alert.ruleInstanceId)
              ? {
                  ...alert,
                  transactionIds: (alert.transactionIds ?? []).filter(
                    (transactionId) => {
                      const transaction = c.caseTransactions?.find(
                        (t) => t.transactionId === transactionId
                      )
                      if (
                        transaction?.createdAt &&
                        transaction.createdAt >= targetStart &&
                        transaction.createdAt <= targetEnd
                      ) {
                        return false
                      }
                      return true
                    }
                  ),
                }
              : alert
          )
          .filter((alert) => alert.transactionIds?.length)

        const caseTransactionIds = compact(
          uniq(flatten(alerts.map((alert) => alert?.transactionIds)))
        )
        const caseTransactions = c.caseTransactions?.filter((caseTransaction) =>
          caseTransactionIds.includes(caseTransaction.transactionId)
        )
        if (!alerts.length) {
          await casesCollection.deleteOne({
            _id: c._id,
          })
          logger.info(`Deleted case ${c.caseId}`)
        } else {
          await casesCollection.updateOne(
            { _id: c._id },
            {
              $set: {
                alerts,
                caseTransactions,
                caseTransactionIds,
              },
            }
          )
          logger.info(`Updated case ${c.caseId}`)
        }
      }
    },
    { mongoBatchSize: 100, processBatchSize: 10 }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
