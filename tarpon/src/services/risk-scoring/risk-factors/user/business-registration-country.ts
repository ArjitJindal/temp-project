import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const CUSTOMER_REGISTRATION_COUNTRY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
  name: 'Business registration country',
  description: 'Risk value based on registration country of the business',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const BUSINESS_REGISTRATION_COUNTRY_RISK_FACTOR =
  CUSTOMER_REGISTRATION_COUNTRY_RISK_FACTOR('BUSINESS')

export const businessRegistrationCountryV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            {
              var: 'BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__SENDER',
            },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
