import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { MIGRATION_TMP_COLLECTION } from '@/utils/mongo-table-names'
import { saveMigrationTmpProgressToDynamo } from '@/utils/migration-progress'

export const up = async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection(MIGRATION_TMP_COLLECTION)
  await processCursorInBatch(
    collection.find({}),
    async (migrationTmp) => {
      await saveMigrationTmpProgressToDynamo(migrationTmp)
    },
    { mongoBatchSize: 1000, processBatchSize: 1000, debug: true }
  )
}
export const down = async () => {
  // skip
}
