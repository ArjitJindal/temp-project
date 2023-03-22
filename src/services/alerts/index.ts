import { Alert } from '@/@types/openapi-internal/Alert'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export const transactionsToAlerts = function (
  caseTransactions: InternalTransaction[],
  caseId?: string
): Alert[] {
  const alertMap: { [key: string]: Alert } = {}
  caseTransactions.map((transaction) => {
    transaction.hitRules.map(async (hitRule) => {
      if (!(hitRule.ruleInstanceId in alertMap)) {
        alertMap[hitRule.ruleInstanceId] = {
          caseId: caseId,
          createdTimestamp: transaction.timestamp,
          latestTransactionArrivalTimestamp: transaction.timestamp,
          alertStatus: 'OPEN',
          ruleId: hitRule.ruleId,
          ruleInstanceId: hitRule.ruleInstanceId,
          ruleName: hitRule.ruleName,
          ruleDescription: hitRule.ruleDescription,
          ruleAction: hitRule.ruleAction,
          numberOfTransactionsHit: 1,
          transactionIds: [transaction.transactionId],
          priority: 'P1',
        }
      } else {
        const alert = alertMap[hitRule.ruleInstanceId]
        const txnSet = new Set(alert.transactionIds).add(
          transaction.transactionId
        )
        alertMap[hitRule.ruleInstanceId] = {
          caseId: caseId,
          ...alert,
          numberOfTransactionsHit: txnSet.size,
          latestTransactionArrivalTimestamp: transaction.timestamp,
          transactionIds: Array.from(txnSet),
        }
      }
    })
  })
  return Object.values(alertMap)
}
