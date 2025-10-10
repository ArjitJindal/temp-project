import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueDayRange } from '@/@types/openapi-internal/all'

const CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'consumerCreatedTimestamp',
  name: 'Consumer user age on platform',
  description:
    'Risk based on how long a consumer has been using your platform (days)',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
  isDerived: true,
  dataType: 'DAY_RANGE',
})

export const TRANSACTION_CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR =
  CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR('TRANSACTION')

export const consumerUserAgePlatformV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const range = parameterValue.content as RiskParameterValueDayRange
  return {
    logic: {
      and: [
        {
          '<=': [
            range.start,
            { var: 'CONSUMER_USER:creationAgeDays__BOTH' },
            range.end,
          ],
        },
      ],
    },
  }
}
