import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const USER_EMPLOYMENT_STATUS_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'employmentStatus',
  name: 'User employment status',
  description: 'Risk based on consumer employment status',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'MULTIPLE',
  type: entityType,
  status: 'INACTIVE',
})

export const CONSUMER_USER_EMPLOYMENT_STATUS_RISK_FACTOR =
  USER_EMPLOYMENT_STATUS_RISK_FACTOR('CONSUMER_USER')

export const userEmploymentStatusV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'CONSUMER_USER:employmentStatus__SENDER' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
