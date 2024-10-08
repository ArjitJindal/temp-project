import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MIGRATION_TMP_COLLECTION } from '@/utils/mongodb-definitions'

export async function getMigrationLastCompletedTimestamp(
  migrationKey: string
): Promise<number | undefined> {
  const mongoDb = (await getMongoDbClient()).db()
  const migrationProgress = await mongoDb
    .collection(MIGRATION_TMP_COLLECTION)
    .findOne({ _id: migrationKey as any })
  return migrationProgress?.lastCompletedTimestamp
}

export async function updateMigrationLastCompletedTimestamp(
  migrationKey: string,
  lastCompletedTimestamp: number
) {
  const mongoDb = (await getMongoDbClient()).db()
  await mongoDb.collection(MIGRATION_TMP_COLLECTION).replaceOne(
    {
      _id: migrationKey as any,
    },
    { lastCompletedTimestamp },
    { upsert: true }
  )
}
