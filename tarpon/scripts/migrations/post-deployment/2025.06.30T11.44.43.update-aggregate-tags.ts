import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts/repository'
import { uniqObjects } from '@/utils/object'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))

  console.log(`Starting migration for tenant: ${tenantId}`)

  // Find all cases that have caseUsers but might not have user tags in caseAggregates
  const casesCursor = casesCollection.find({
    caseUsers: { $exists: true },
    $or: [
      { 'caseUsers.origin': { $exists: true } },
      { 'caseUsers.destination': { $exists: true } },
    ],
  })

  let processedCount = 0
  let updatedCount = 0

  await processCursorInBatch(
    casesCursor,
    async (batch) => {
      for (const case_ of batch) {
        processedCount++
        const caseUsers = case_.caseUsers
        if (!caseUsers) {
          continue
        }

        // Collect user tags from origin and destination users
        const userTags: Array<{ key: string; value: string }> = []

        if (
          caseUsers.origin &&
          'tags' in caseUsers.origin &&
          caseUsers.origin.tags
        ) {
          userTags.push(...caseUsers.origin.tags)
        }

        if (
          caseUsers.destination &&
          'tags' in caseUsers.destination &&
          caseUsers.destination.tags
        ) {
          userTags.push(...caseUsers.destination.tags)
        }

        // If no user tags found, skip this case
        if (userTags.length === 0) {
          continue
        }

        // Get existing transaction tags from caseAggregates
        const existingTags = case_.caseAggregates?.tags || []

        // Combine transaction tags and user tags, removing duplicates
        const combinedTags = uniqObjects(existingTags.concat(userTags))

        // skip update if no tags are added
        if (combinedTags.length === existingTags.length) {
          continue
        }

        // Update the case with the new combined tags
        await casesCollection.updateOne(
          { caseId: case_.caseId },
          {
            $set: {
              'caseAggregates.tags': combinedTags,
            },
          }
        )

        updatedCount++

        if (updatedCount % 100 === 0) {
          console.log(
            `Tenant ${tenantId}: Processed ${processedCount} cases, updated ${updatedCount} cases`
          )
        }
      }
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 200,
    }
  )

  console.log(
    `Migration completed for tenant ${tenantId}: Processed ${processedCount} cases, updated ${updatedCount} cases`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip - this is a data enhancement migration, no rollback needed
}
