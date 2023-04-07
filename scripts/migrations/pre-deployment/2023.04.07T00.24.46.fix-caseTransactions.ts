import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  const db = mongodb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cursor = casesCollection.aggregate([
    {
      $project: {
        caseTransactionsCount: {
          $size: { $ifNull: ['$caseTransactions', []] },
        },
        caseTransactionsIdsCount: {
          $size: { $ifNull: ['$caseTransactionsIds', []] },
        },
      },
    },
    {
      $match: {
        $expr: {
          $ne: ['$caseTransactionsCount', '$caseTransactionsIdsCount'],
        },
      },
    },
  ])

  for await (const c of cursor) {
    const caseObj = await casesCollection.findOne({ _id: c._id })
    const caseTransactions = caseObj?.caseTransactions ?? []
    const newCaseTransactions = _.uniqBy(
      _.reverse(caseTransactions),
      (t) => t.transactionId
    )
    await casesCollection.replaceOne(
      { _id: c._id },
      {
        ...caseObj,
        caseTransactions: newCaseTransactions,
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
