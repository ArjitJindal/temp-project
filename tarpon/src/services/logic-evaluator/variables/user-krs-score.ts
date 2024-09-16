import { CommonUserLogicVariable, LogicVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

export const USER_KRS_SCORE: CommonUserLogicVariable = {
  // key is `userKRSScore` instead of `krsScore` for verbosity
  key: 'userKRSScore',
  entity: 'USER',
  valueType: 'number',
  uiDefinition: {
    label: 'KRS Score',
    type: 'number',
    valueSources: ['value', 'field', 'func'],
  },
  requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
  load: async (user: User | Business, context?: LogicVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }

    if (!hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      // This block would not be run as the required feature flags are already
      // set in the `requiredFeatures` definition above
      return undefined
    }

    const dynamoDb = context.dynamoDb
    const riskRepository = new RiskRepository(context.tenantId, {
      dynamoDb,
    })
    return (await riskRepository.getKrsScore(user.userId))?.krsScore
  },
}
