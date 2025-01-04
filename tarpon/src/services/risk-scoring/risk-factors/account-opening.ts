import { RiskFactorLogicGenerator, V2V8RiskFactor } from './types'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import {
  RiskEntityType,
  RiskParameterValueLiteral,
} from '@/@types/openapi-internal/all'

const REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'reasonForAccountOpening',
  name: 'Reason for account opening',
  description: 'Risk based on reason for account opening',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'LITERAL',
  type: entityType,
  status: 'INACTIVE',
})

export const CONSUMER_USER_REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR =
  REASON_FOR_ACCOUNT_OPENING_RISK_FACTOR('CONSUMER_USER')

export const reasonForAccountOpeningV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          some: [
            { var: 'CONSUMER_USER:reasonForAccountOpening__SENDER' },
            {
              in: [
                { var: '' },
                (parameterValue.content as RiskParameterValueLiteral).content,
              ],
            },
          ],
        },
      ],
    },
  }
}
