import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const CUSTOMER_DIRECTORS_COUNTRY_OF_NATIONALITY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'directors',
  name: 'Directors country of nationality',
  description: 'Risk value based on director country of the nationality',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const BUSINESS_DIRECTORS_COUNTRY_OF_NATIONALITY_RISK_FACTOR =
  CUSTOMER_DIRECTORS_COUNTRY_OF_NATIONALITY_RISK_FACTOR('BUSINESS')

export const directorsCountryOfNationalityV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          some: [
            { var: 'BUSINESS_USER:directors__SENDER' },
            {
              in: [
                { var: 'generalDetails.countryOfNationality' },
                (
                  parameterValue.content as RiskParameterValueMultiple
                ).values?.map((val) => val.content),
              ],
            },
          ],
        },
      ],
    },
  }
}
