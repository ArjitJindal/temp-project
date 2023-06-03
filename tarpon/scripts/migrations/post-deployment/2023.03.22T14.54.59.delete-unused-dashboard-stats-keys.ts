import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collectionNameUserStats =
    DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)
  const collectionNameRuleStats =
    DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)

  await db.collection(collectionNameRuleStats).updateMany(
    {},
    {
      $unset: {
        'rulesStats.$[].transactionCasesCount': '',
        'rulesStats.$[].userCasesCount': '',
        'rulesStats.$[].openTransactionCasesCount': '',
        'rulesStats.$[].openUserCasesCount': '',
      },
    }
  )

  await db.collection(collectionNameUserStats).updateMany(
    {},
    {
      $unset: {
        openTransactionCasesCount: '',
        openUserCasesCount: '',
        transactionCasesCount: '',
        userCasesCount: '',
      },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
