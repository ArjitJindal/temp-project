import { chunk } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { Alert } from '@/@types/openapi-internal/Alert'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'

async function migrateTenant(tenant: Tenant) {
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
  const mongoDb = await getMongoDbClient()
  const db = await getMongoDbClientDb()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const cases = await casesCollection
    .find({
      alerts: {
        $exists: true,
      },
    })
    .toArray()

  const alerts = cases
    .flatMap((case_) => case_.alerts)
    .filter((alert) =>
      closed ? alert?.alertStatus === 'CLOSED' : alert?.alertStatus !== 'CLOSED'
    ) as Alert[]

  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb
  )
  for (const alert of alerts) {
    for (const txChunk of chunk(alert.transactionIds, 500)) {
      if (alert.alertId)
        await transactionRepository.updateTransactionAlertIds(txChunk, [
          alert.alertId,
        ])
    }
  }
}
