import { RiskFactorLogicGenerator, V2V8RiskFactor } from './types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const CUSTOMER_TYPE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'type',
  name: 'Customer type',
  description: 'Risk value for consumer (individuals) users',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const CONSUMER_TYPE_RISK_FACTOR =
  CUSTOMER_TYPE_RISK_FACTOR('CONSUMER_USER')
export const BUSINESS_TYPE_RISK_FACTOR = CUSTOMER_TYPE_RISK_FACTOR('BUSINESS')

export const customerTypeV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'USER:type__SENDER' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
