import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { map } from 'lodash'
import { humanizeConstant } from '@flagright/lib/utils/humanize'
import { CommonUserRuleVariable, RuleVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures } from '@/core/utils/context'
import { RiskScoringService } from '@/services/risk-scoring'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const USER_CRA_LEVEL: CommonUserRuleVariable = {
  // key is `userCRALevel` instead of `craLevel` for verbosity
  key: 'userCRALevel',
  entity: 'USER',
  valueType: 'string',
  uiDefinition: {
    label: 'CRA Level',
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: map(RISK_LEVELS, (riskLevel) => {
        return { title: humanizeConstant(riskLevel), value: riskLevel }
      }),
    },
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
    const riskConfig = await riskScoringService.getRiskConfig()
    const craScore = await riskScoringService.getDrsScore(user.userId)
    return getRiskLevelFromScore(
      riskConfig.riskClassificationValues,
      craScore ?? null
    )
  },
}
