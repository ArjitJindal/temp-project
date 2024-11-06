import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { map } from 'lodash'
import { humanizeConstant } from '@flagright/lib/utils/humanize'
import { CommonUserLogicVariable, LogicVariableContext } from './types'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { hasFeatures } from '@/core/utils/context'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

const getVariableDefinition = (
  key: string,
  label: string
): Omit<CommonUserLogicVariable, 'load'> => ({
  key,
  entity: 'USER',
  valueType: 'string',
  uiDefinition: {
    label,
    type: 'select',
    valueSources: ['value', 'field', 'func'],
    fieldSettings: {
      listValues: map(RISK_LEVELS, (riskLevel) => {
        return { title: humanizeConstant(riskLevel), value: riskLevel }
      }),
    },
  },
  requiredFeatures: ['RISK_SCORING', 'RISK_LEVELS'],
})

export const USER_CRA_LEVEL: CommonUserLogicVariable = {
  // key is `userCRALevel` instead of `craLevel` for verbosity
  ...getVariableDefinition('userCRALevel', 'CRA risk level'),
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
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const craScore = await riskRepository.getDrsScore(user.userId)
    return getRiskLevelFromScore(
      riskClassificationValues,
      craScore?.drsScore ?? null
    )
  },
}

export const USER_PREVIOUS_CRA_LEVEL: CommonUserLogicVariable = {
  ...getVariableDefinition('userPreviousCRALevel', 'Previous CRA risk level'),
  load: async (user: User | Business, context?: LogicVariableContext) => {
    if (!context) {
      throw new Error('Missing context')
    }

    if (!hasFeatures(['RISK_SCORING', 'RISK_LEVELS'])) {
      return null
    }

    const dynamoDb = context.dynamoDb
    const riskRepository = new RiskRepository(context.tenantId, {
      dynamoDb,
    })
    const previousCraLevel = await riskRepository.getPreviousCraLevel(
      user.userId
    )
    return previousCraLevel
  },
}
