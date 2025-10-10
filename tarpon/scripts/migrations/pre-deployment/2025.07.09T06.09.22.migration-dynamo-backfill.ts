import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  Migration,
  saveMigrationProgressToDynamo,
} from '@/utils/migration-progress'

export const up = async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  let collection = db.collection<Migration>('migrations-pre-deployment')
  await processCursorInBatch(
    collection.find({}),
    async (migrations) => {
      await saveMigrationProgressToDynamo(migrations, 'PRE_DEPLOYMENT')
    },
    { mongoBatchSize: 1000, processBatchSize: 1000, debug: true }
  )
  collection = db.collection<Migration>('migrations-post-deployment')
  await processCursorInBatch(
    collection.find({}),
    async (migrations) => {
      await saveMigrationProgressToDynamo(migrations, 'POST_DEPLOYMENT')
    },
    { mongoBatchSize: 1000, processBatchSize: 1000, debug: true }
  )
}
export const down = async () => {
  // skip
}
