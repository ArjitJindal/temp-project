import { Filter } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))

  let counter = 0
  let updatedCounter = 0
  const filter: Filter<Case> = {
    caseType: 'SYSTEM',
    subjectType: { $eq: undefined },
    relatedCases: { $exists: true, $ne: [] },
  }
  const totalCount = await casesCollection.countDocuments(filter)
  for await (const { caseId, relatedCases = [] } of casesCollection.find(
    filter
  )) {
    const parentCaseId = relatedCases[relatedCases.length - 1]

    if (parentCaseId) {
      const parentCase = await casesCollection.findOne({
        caseId: parentCaseId,
      })

      if (parentCase) {
        const updateResult = await casesCollection.updateOne(
          {
            caseId,
          },
          {
            $set: {
              subjectType: parentCase.subjectType ?? 'USER',
              paymentDetails: parentCase.paymentDetails,
            },
          }
        )
        updatedCounter += updateResult.modifiedCount
      }
    }
    counter++
    console.log(`Handled ${counter}/${totalCount} cases`)
  }
  console.log(`Handled ${counter} searches, updated ${updatedCounter}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

if (require.main === module) {
  migrateTenant({
    id: 'flagright',
    name: 'name',
    orgId: 'orgId',
    apiAudience: 'apiAudience',
    region: 'region',
    isProductionAccessDisabled: true,
  }).then(
    () => {
      console.log('Done')
      process.exit(0)
    },
    (e) => {
      console.error(e)
      process.exit(1)
    }
  )
}
