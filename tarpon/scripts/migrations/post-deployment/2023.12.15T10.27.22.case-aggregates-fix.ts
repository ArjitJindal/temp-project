import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { uniqObjects } from '@/utils/object'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const cases = db.collection<Case>(CASES_COLLECTION(tenant.id))

  const cursor = cases.find({ 'caseAggregates.tags.0': { $exists: true } })

  console.log(`Found ${await cursor.count()} cases to migrate`)

  let i = 0
  for await (const doc of cursor) {
    const tags = doc.caseAggregates.tags
    const tagsWithoutDuplicates = uniqObjects(tags)

    await cases.updateOne(
      { _id: doc._id },
      { $set: { 'caseAggregates.tags': tagsWithoutDuplicates } }
    )

    console.log(`Migrated case ${doc.caseId}`)
    console.log(`Progress: ${++i}/${await cursor.count()}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
