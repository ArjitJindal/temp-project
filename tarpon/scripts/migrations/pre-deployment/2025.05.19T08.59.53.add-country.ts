import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION } from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'
import { extractCountryFromSource } from '@/services/sanctions/utils'

export const up = async () => {
  logger.info('Starting migration to add sourceCountry field')
  const mongoDb = await getMongoDbClient()
  const collection = mongoDb
    .db()
    .collection(SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION())

  const totalCount = await collection.countDocuments()
  logger.info(`Total documents to process: ${totalCount}`)

  const cursor = collection.find(
    {},
    { projection: { _id: 1, sourceName: 1, sourceType: 1 } }
  )

  let processedCount = 0
  let updatedCount = 0
  let skippedCount = 0

  await processCursorInBatch(cursor, async (batch) => {
    processedCount += batch.length

    const bulkOps = batch
      .filter((source) => {
        const isValidType =
          source.sourceType === 'REGULATORY_ENFORCEMENT_LIST' ||
          source.sourceType === 'SANCTIONS'
        if (!isValidType) {
          skippedCount++
          return false
        }
        return true
      })
      .map((source) => {
        const sourceCountry = extractCountryFromSource(
          source.sourceName,
          source.sourceType
        )
        if (sourceCountry) {
          logger.debug(
            `Extracted country '${sourceCountry}' from source: ${source.sourceName}`
          )
        } else {
          logger.warn(
            `Could not extract country from source: ${source.sourceName}`
          )
        }
        return {
          updateOne: {
            filter: { _id: source._id },
            update: { $set: { sourceCountry } },
          },
        }
      })

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps)
      updatedCount += bulkOps.length
    }

    logger.info(
      `Progress: ${processedCount}/${totalCount} documents processed, ${updatedCount} updated, ${skippedCount} skipped`
    )
  })

  logger.info('Migration completed:')
  logger.info(`- Total documents processed: ${processedCount}`)
  logger.info(`- Documents updated: ${updatedCount}`)
  logger.info(`- Documents skipped: ${skippedCount}`)
}

export const down = async () => {
  // skip
}
