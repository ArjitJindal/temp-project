import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValueDayRange } from '@/@types/openapi-internal/RiskParameterValueDayRange'

const CUSTOMER_AGE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'userDetails.dateOfBirth',
  name: 'Customer age',
  description: 'Risk based on customer age range (years)',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'RANGE',
  type: entityType,
  status: 'INACTIVE',
  isDerived: true,
  dataType: 'RANGE',
})

export const CONSUMER_CUSTOMER_AGE_RISK_FACTOR =
  CUSTOMER_AGE_RISK_FACTOR('CONSUMER_USER')

export const customerAgeV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const range = parameterValue.content as RiskParameterValueDayRange
  return {
    logic: {
      and: [
        {
          '<=': [
            range.start,
            { var: 'CONSUMER_USER:ageYears__SENDER' },
            range.end,
          ],
        },
      ],
    },
  }
}
