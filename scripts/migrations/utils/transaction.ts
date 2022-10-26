import { FindCursor, WithId } from 'mongodb'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'

const TRANSACTIONS_BATCH_SIZE = 1000

export async function migrateTransactions(
  transactionsCursor: FindCursor<WithId<TransactionCaseManagement>>,
  processTransactions: (
    transactionsBatch: TransactionCaseManagement[]
  ) => Promise<void>
) {
  const cursor = transactionsCursor.batchSize(TRANSACTIONS_BATCH_SIZE)
  let pendingTransactions: TransactionCaseManagement[] = []
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
