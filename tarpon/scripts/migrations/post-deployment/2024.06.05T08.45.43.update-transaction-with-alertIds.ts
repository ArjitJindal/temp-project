import { chunk } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === 'FT398YYJMD') {
    // See https://flagright.slack.com/archives/C03L5KRE2E8/p1717681131153909?thread_ts=1717601101.570059&cid=C03L5KRE2E8
    await updateCaseTransactions(tenant.id, true)
  }
  await updateCaseTransactions(tenant.id, false)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

export async function updateCaseTransactions(
  tenantId: string,
  closed: boolean
) {
  if (['WAYPDLPSXQ', 'U7O12AVVL9'].includes(tenantId)) {
    return
  }
  const migrationKey = `2024.06.05T08.45.24.update-transaction-with-alertIds__${tenantId}_${closed}`
  const migrationLastCompletedTimestamp =
    await getMigrationLastCompletedTimestamp(migrationKey)

  const mongoDb = await getMongoDbClient()
  const db = await getMongoDbClientDb()
  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb
  )
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const casesCursor = await casesCollection
    .find({
      createdTimestamp: { $gt: migrationLastCompletedTimestamp ?? 0 },
      'alerts.0': { $exists: true },
      'alerts.alertStatus': closed ? 'CLOSED' : { $ne: 'CLOSED' },
    })
    .sort({ createdTimestamp: 1 })

  for await (const caseDoc of casesCursor) {
    const alerts =
      caseDoc.alerts?.filter((alert) =>
        closed ? alert.alertStatus === 'CLOSED' : alert.alertStatus !== 'CLOSED'
      ) ?? []
    for (const alert of alerts) {
      for (const txChunk of chunk(alert.transactionIds, 1000)) {
        if (alert.alertId) {
          await transactionRepository.updateTransactionAlertIds(txChunk, [
            alert.alertId,
          ])
        }
      }
    }
    logger.info(`Updated case ${caseDoc.caseId} with ${alerts.length} alerts`)
    await updateMigrationLastCompletedTimestamp(
      migrationKey,
      caseDoc.createdTimestamp as number
    )
  }
}
