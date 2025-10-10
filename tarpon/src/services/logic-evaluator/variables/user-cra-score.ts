import { CommonUserLogicVariable, LogicVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

export const USER_CRA_SCORE: CommonUserLogicVariable = {
  // key is `userCRAScore` instead of `craScore` for verbosity
  key: 'userCRAScore',
  entity: 'USER',
  valueType: 'number',
  uiDefinition: {
    label: 'CRA Score',
    type: 'number',
    valueSources: ['value', 'field', 'func'],
  },
  requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
  load: async (user: User | Business, context?: LogicVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }

    if (!hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      return 0
    }

    const dynamoDb = context.dynamoDb
    const riskRepository = new RiskRepository(context.tenantId, {
      dynamoDb,
    })
    // DRSScore is CRAScore
    return (await riskRepository.getDrsScore(user.userId))?.drsScore
  },
}
