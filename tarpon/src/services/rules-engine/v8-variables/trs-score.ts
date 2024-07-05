import { DEFAULT_RISK_LEVEL, getRiskScoreFromLevel } from '@flagright/lib/utils'
import { TransactionRuleVariable } from './types'
import { hasFeatures } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

export const TRANSACTION_TRS_SCORE: TransactionRuleVariable<number> = {
  entity: 'TRANSACTION',
  key: 'trsScore',
  valueType: 'number',
  uiDefinition: {
    label: 'TRS Score',
    type: 'number',
    valueSources: ['value', 'field', 'func'],
  },
  requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
  load: async (transaction, context) => {
    if (!transaction) {
      return NaN
    }

    let riskScore = transaction?.riskScoreDetails?.trsScore

    if (riskScore != null) {
      return riskScore
    }

    if (context && hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      const riskRepository = new RiskRepository(context.tenantId, {
        dynamoDb: context.dynamoDb,
      })

      if (!riskScore && transaction?.transactionId) {
        riskScore = (
          await riskRepository.getArsScore(transaction.transactionId)
        )?.arsScore
      }

      if (!riskScore) {
        const riskClassificationValues =
          await riskRepository.getRiskClassificationValues()

        riskScore = getRiskScoreFromLevel(
          riskClassificationValues,
          DEFAULT_RISK_LEVEL
        )
      }
    }

    return riskScore ?? 0
  },
  sourceField: 'riskScoreDetails',
}
