import { CommonUserRuleVariable, RuleVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures } from '@/core/utils/context'
import { RiskScoringService } from '@/services/risk-scoring'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const USER_KRS_SCORE: CommonUserRuleVariable = {
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
  load: async (user: User | Business, context?: RuleVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }

    if (!hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      // This block would not be run as the required feature flags are already
      // set in the `requiredFeatures` definition above
      return undefined
    }

    const dynamoDb = context.dynamoDb
    const mongoDb = await getMongoDbClient()
    const riskScoringService = new RiskScoringService(context.tenantId, {
      dynamoDb,
      mongoDb,
    })
    return await riskScoringService.getKrsScore(user.userId)
  },
}
