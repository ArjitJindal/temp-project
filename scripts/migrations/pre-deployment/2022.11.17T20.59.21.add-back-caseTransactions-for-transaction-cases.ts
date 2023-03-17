/**
 * We used to store the actual transaction payload in a case (in caseTransactions), but we
 * removed it when fixing a user case issue (https://github.com/flagright/tarpon/pull/558) that
 * we were storing too many transactions in a single case and reached the max 16MB document limit.
 * For TRANSACTION case, we need to save the actual caseTransactions because we need to display
 * transaction info in the case table. Relying on $lookup will literally scan all the cases.
 */

import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'

async function migrateTenant(tenant: Tenant, revert: boolean) {
  const mongoDb = await getMongoDbClient()
  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb,
  })
  const transactionsRepo = new MongoDbTransactionRepository(tenant.id, mongoDb)
  const cursor = await caseRepository.getCasesCursor({
    includeTransactions: false,
    pageSize: 'DISABLED',
  })
  for await (const c of cursor) {
    if (
      !c.caseId ||
      (c.caseTransactions && c.caseTransactions.length > 0 && !revert)
    ) {
      continue
    }
    const caseTransactions = revert
      ? undefined
      : (
          await transactionsRepo.getTransactions({
            filterIdList: (c.caseTransactionsIds as any) || [],
            afterTimestamp: 0,
            beforeTimestamp: Number.MAX_SAFE_INTEGER,
            pageSize: 'DISABLED',
            includeUsers: false,
          })
        ).data
    await caseRepository.addCaseMongo({ ...c, caseTransactions })
    console.info(`Migrated case ${c.caseId}`)
  }
}

export const up = async () => {
  await migrateAllTenants((tenant) => migrateTenant(tenant, false))
}
export const down = async () => {
  await migrateAllTenants((tenant) => migrateTenant(tenant, true))
}
