import { CommonUserRuleVariable, RuleVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures } from '@/core/utils/context'
import { RiskScoringService } from '@/services/risk-scoring'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const USER_CRA_SCORE: CommonUserRuleVariable = {
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
  load: async (user: User | Business, context?: RuleVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }

    if (!hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      return 0
    }

    const dynamoDb = context.dynamoDb
    const mongoDb = await getMongoDbClient()
    const riskScoringService = new RiskScoringService(context.tenantId, {
      dynamoDb,
      mongoDb,
    })
    // DRSScore is CRAScore
    return await riskScoringService.getDrsScore(user.userId)
  },
}
