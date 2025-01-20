import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const COUNTRY_OF_RESIDENCE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'userDetails.countryOfResidence',
  name: 'Country of Residence',
  description: 'Risk based on customer residence country',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'MULTIPLE',
  type: entityType,
  status: 'INACTIVE',
})

export const CONSUMER_COUNTRY_OF_RESIDENCE_RISK_FACTOR =
  COUNTRY_OF_RESIDENCE_RISK_FACTOR('CONSUMER_USER')

export const countryOfResidenceV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'CONSUMER_USER:userDetails-countryOfResidence__SENDER' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
