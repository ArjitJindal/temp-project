import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueTimeRange } from '@/@types/openapi-internal/all'

const TRANSACTION_TIME_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'timestamp',
  name: 'Transaction time',
  description: 'Risk based on time of transaction',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const TRANSACTION_TIME_FOR_RISK_FACTOR =
  TRANSACTION_TIME_RISK_FACTOR('TRANSACTION')

export const transactionTimeV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const range = parameterValue.content as RiskParameterValueTimeRange
  return {
    logic: {
      and: [
        {
          'op:between_time': [
            {
              local_time_in_hour: [
                { var: 'TRANSACTION:timestamp' },
                range.timezone,
              ],
            },
            range.startHour,
            range.endHour,
          ],
        },
        {
          '!=': [
            {
              local_time_in_hour: [
                { var: 'TRANSACTION:timestamp' },
                range.timezone,
              ],
            },
            range.endHour,
          ],
        },
      ],
    },
  }
}
