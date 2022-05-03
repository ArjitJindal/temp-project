import UserTransactionPairsRule from './user-transaction-pairs'

// A match order transaction has the transactionId with the format - `${orderId}-${fillOrderId}`
const MATCH_ORDER_SEPARATOR = '-'

export default class UserTransactionPairsIcrypexRule extends UserTransactionPairsRule {
  async getSenderSendingTransactions() {
    const seenOrderIds = new Set()
    const sendingTransactions = await super.getSenderSendingTransactions()
    const newSendingTransactions = sendingTransactions.filter((transaction) => {
      const [orderId, fillOrderId] = transaction.transactionId.split(
        MATCH_ORDER_SEPARATOR
      )
      const shouldUse =
        !seenOrderIds.has(orderId) && !seenOrderIds.has(fillOrderId)
      seenOrderIds.add(orderId)
      if (fillOrderId) {
        seenOrderIds.add(fillOrderId)
      }
      return shouldUse
    })
    return newSendingTransactions
  }
}
