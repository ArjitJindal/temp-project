import { FindCursor, WithId } from 'mongodb'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const TRANSACTIONS_BATCH_SIZE = 1000

export async function migrateTransactions(
  transactionsCursor: FindCursor<WithId<InternalTransaction>>,
  processTransactions: (
    transactionsBatch: InternalTransaction[]
  ) => Promise<void>
) {
  const cursor = transactionsCursor.batchSize(TRANSACTIONS_BATCH_SIZE)
  let pendingTransactions: InternalTransaction[] = []
  for await (const transaction of cursor) {
    pendingTransactions.push(transaction)
    if (pendingTransactions.length === TRANSACTIONS_BATCH_SIZE) {
      await processTransactions(pendingTransactions)
      pendingTransactions = []
    }
  }
  if (pendingTransactions.length > 0) {
    await processTransactions(pendingTransactions)
  }
}
