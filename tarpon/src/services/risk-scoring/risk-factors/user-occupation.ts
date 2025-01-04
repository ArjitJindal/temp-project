import { RiskFactorLogicGenerator, V2V8RiskFactor } from './types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueLiteral } from '@/@types/openapi-internal/RiskParameterValueLiteral'

const USER_OCCUPATION_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'occupation',
  name: 'User occupation',
  description: 'Risk based on consumer occupation',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'LITERAL',
  type: entityType,
  status: 'INACTIVE',
})

export const CONSUMER_USER_OCCUPATION_RISK_FACTOR =
  USER_OCCUPATION_RISK_FACTOR('CONSUMER_USER')

export const userOccupationV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          '==': [
            { var: 'CONSUMER_USER:occupation__SENDER' },
            (parameterValue.content as RiskParameterValueLiteral).content,
          ],
        },
      ],
    },
  }
}
