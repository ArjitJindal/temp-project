import { RiskFactorLogicGenerator, V2V8RiskFactor } from './types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const SOURCE_OF_FUNDS_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'sourceOfFunds',
  name: 'Source of funds',
  description: 'Risk based on source of funds',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'MULTIPLE',
  type: entityType,
  status: 'INACTIVE',
})

export const CONSUMER_USER_SOURCE_OF_FUNDS_RISK_FACTOR =
  SOURCE_OF_FUNDS_RISK_FACTOR('CONSUMER_USER')

export const sourceOfFundsV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          some: [
            { var: 'CONSUMER_USER:sourceOfFunds__SENDER' },
            {
              in: [
                { var: '' },
                (
                  parameterValue.content as RiskParameterValueMultiple
                ).values.map((val) => val.content),
              ],
            },
          ],
        },
      ],
    },
  }
}
