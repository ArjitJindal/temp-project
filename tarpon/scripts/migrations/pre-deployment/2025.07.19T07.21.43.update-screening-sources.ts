import { AnyBulkWriteOperation } from 'mongodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION } from '@/utils/mongodb-definitions'
import { SourceDocument } from '@/@types/openapi-internal/SourceDocument'
import { generateHashFromString } from '@/utils/object'

export const up = async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collections = await db.listCollections().toArray()
  if (
    !collections.some(
      (c) => c.name === SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION()
    )
  ) {
    return
  }
  const sourcesCollection = db.collection<SourceDocument>(
    SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION()
  )
  const sourcesCursor = sourcesCollection.find({})
  await processCursorInBatch(sourcesCursor, async (sources) => {
    const bulkOps: AnyBulkWriteOperation<SourceDocument>[] = []
    const updatedSources = sources
      .filter((source) => source.sourceName)
      .map((source) => {
        if (!source.sourceName) {
          return source
        }
        return {
          ...source,
          refId: generateHashFromString(source.sourceName),
        }
      })
    bulkOps.push(
      ...updatedSources.map((s) => ({
        updateOne: {
          filter: { id: s.id },
          update: { $set: { refId: s.refId } },
        },
      }))
    )
    await sourcesCollection.bulkWrite(bulkOps)
  })
  await db
    .collection(SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION())
    .createIndex({ refId: 1 })
}
export const down = async () => {
  // skip
}
