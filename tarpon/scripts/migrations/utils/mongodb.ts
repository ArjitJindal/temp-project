import { FindCursor, WithId } from 'mongodb'

export async function migrateEntities<T>(
  entityCursor: FindCursor<WithId<T>>,
  processBatch: (batch: WithId<T>[]) => Promise<void>,
  options?: {
    mongoBatchSize?: number
    processBatchSize?: number
  }
) {
  const mongoBatchSize = options?.mongoBatchSize ?? 1000
  const processBatchSize = options?.processBatchSize ?? 1000
  const cursor = entityCursor.batchSize(mongoBatchSize)
  let pendingEntities: WithId<T>[] = []
  for await (const entity of cursor) {
    pendingEntities.push(entity)
    if (pendingEntities.length === processBatchSize) {
      await processBatch(pendingEntities)
      pendingEntities = []
    }
  }
  if (pendingEntities.length > 0) {
    await processBatch(pendingEntities)
  }
}
