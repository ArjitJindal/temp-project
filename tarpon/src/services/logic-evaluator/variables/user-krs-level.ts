import { getRiskLevelFromScore } from '@flagright/lib/utils'
import map from 'lodash/map'
import { humanizeConstant } from '@flagright/lib/utils/humanize'
import { CommonUserLogicVariable, LogicVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures, tenantSettings } from '@/core/utils/context'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

export const USER_KRS_LEVEL: CommonUserLogicVariable = {
  // key is `userKRSLevel` instead of `krsLevel` for verbosity
  key: 'userKRSLevel',
  entity: 'USER',
  valueType: 'string',
  uiDefinition: {
    label: 'KRS risk level',
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: map(RISK_LEVELS, (riskLevel) => {
        return { title: humanizeConstant(riskLevel), value: riskLevel }
      }),
      allowCustomValues: true,
    },
  },
  requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
  load: async (user: User | Business, context?: LogicVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }

    if (!hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      return undefined
    }

    const dynamoDb = context.dynamoDb
    const riskRepository = new RiskRepository(context.tenantId, {
      dynamoDb,
    })
    const { riskLevelAlias } = await tenantSettings(context.tenantId)
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const krsScore = await riskRepository.getKrsScore(user.userId)
    return getRiskLevelFromScore(
      riskClassificationValues,
      krsScore?.krsScore ?? null,
      riskLevelAlias
    )
  },
}
