import { Alert } from '@/@types/openapi-internal/Alert'
import { CaseTransaction } from '@/@types/openapi-internal/CaseTransaction'

export const transactionsToAlerts = function (
  caseTransactions: CaseTransaction[],
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
          priority: 'P1',
        }
      } else {
        alertMap[hitRule.ruleInstanceId] = {
          caseId: caseId,
          ...alertMap[hitRule.ruleInstanceId],
          numberOfTransactionsHit:
            alertMap[hitRule.ruleInstanceId].numberOfTransactionsHit + 1,
          latestTransactionArrivalTimestamp: transaction.timestamp,
        }
      }
    })
  })
  return Object.values(alertMap)
}
