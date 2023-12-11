import { compact, uniq } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { logger } from '@/core/logger'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()

  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(casesCollectionName)

  const cases = casesCollection.find({
    caseAggregates: { $exists: false },
  })

  logger.info(
    `Migrating ${casesCollectionName} for tenant ${
      tenant.id
    } total cases: ${await cases.count()}`
  )

  for await (const caseItem of cases) {
    logger.info(`Migrating case ${caseItem._id}`)
    const caseTransactions = caseItem.caseTransactions ?? []

    const allOriginPaymentMethods = compact(
      uniq(
        caseTransactions.map(
          (transaction) => transaction?.originPaymentDetails?.method
        )
      )
    )

    const allDestinationPaymentMethods = compact(
      uniq(
        caseTransactions.map(
          (transaction) => transaction?.destinationPaymentDetails?.method
        )
      )
    )

    const allTags = compact(
      uniq(caseTransactions.flatMap((transaction) => transaction?.tags))
    )

    const caseAggregates: CaseAggregates = {
      originPaymentMethods: allOriginPaymentMethods,
      destinationPaymentMethods: allDestinationPaymentMethods,
      tags: allTags,
    }

    logger.info(`Updating case ${caseItem._id}`)

    await casesCollection.updateOne(
      { _id: caseItem._id },
      { $set: { caseAggregates } }
    )

    logger.info(`Case ${caseItem._id} updated`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
