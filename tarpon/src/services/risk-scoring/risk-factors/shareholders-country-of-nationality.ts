import { RiskFactorLogicGenerator, V2V8RiskFactor } from './types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const CUSTOMER_SHAREHOLDERS_COUNTRY_OF_NATIONALITY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'shareHolders',
  name: 'Shareholders country of nationality',
  description: 'Risk value based on shareholder country of the nationality',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const BUSINESS_SHAREHOLDERS_COUNTRY_OF_NATIONALITY_RISK_FACTOR =
  CUSTOMER_SHAREHOLDERS_COUNTRY_OF_NATIONALITY_RISK_FACTOR('BUSINESS')

export const shareholdersCountryOfNationalityV8Logic: RiskFactorLogicGenerator =
  (parameterValue: RiskParameterValue): { logic: any } => {
    return {
      logic: {
        and: [
          { var: 'BUSINESS_USER:shareHolders__SENDER' },
          {
            in: [
              { var: 'generalDetails.countryOfNationality' },
              (parameterValue.content as RiskParameterValueMultiple).values.map(
                (val) => val.content
              ),
            ],
          },
        ],
      },
    }
  }
