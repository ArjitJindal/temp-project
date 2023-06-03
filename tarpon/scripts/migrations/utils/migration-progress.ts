import {
  MIGRATION_TMP_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'

export async function getMigrationLastCompletedTimestamp(
  migrationKey: string
): Promise<number | undefined> {
  const mongoDb = (await getMongoDbClient()).db()
  const migrationProgress = await mongoDb
    .collection(MIGRATION_TMP_COLLECTION)
    .findOne({ _id: migrationKey })
  return migrationProgress?.lastCompletedTimestamp
}

export async function updateMigrationLastCompletedTimestamp(
  migrationKey: string,
  lastCompletedTimestamp: number
) {
  const mongoDb = (await getMongoDbClient()).db()
  await mongoDb.collection(MIGRATION_TMP_COLLECTION).replaceOne(
    {
      _id: migrationKey,
    },
    { lastCompletedTimestamp },
    { upsert: true }
  )
}
