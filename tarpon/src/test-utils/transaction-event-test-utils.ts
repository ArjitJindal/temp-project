import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

export function getTestTransactionEvent(
  transactionEvent: Partial<TransactionEvent> = {}
): TransactionEvent {
  return {
    transactionId: 'dummy',
    timestamp: Date.now(),
    transactionState: 'CREATED',
    updatedTransactionAttributes: {},
    ...transactionEvent,
  }
}
