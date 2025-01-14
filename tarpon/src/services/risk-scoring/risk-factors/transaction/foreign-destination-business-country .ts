import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import {
  RiskParameterValue,
  RiskParameterValueMultiple,
} from '@/@types/openapi-internal/all'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'

const FOREIGN_DESTINATION_BUSINESS_COUNTRY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'domesticOrForeignDestinationCountryBusiness',
  name: 'Foreign destination country (Consumer)',
  description:
    'Risk value based on whether the user country of residence is same as transaction destination country',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const TRANSACTION_FOREIGN_DESTINATION_BUSINESS_COUNTRY_RISK_FACTOR =
  FOREIGN_DESTINATION_BUSINESS_COUNTRY_RISK_FACTOR('TRANSACTION')

export const foreignDestinationBusinessCountryV8Logic: RiskFactorLogicGenerator =
  (parameterValue: RiskParameterValue): { logic: any } => {
    const parameterValueContent = (
      parameterValue.content as RiskParameterValueMultiple
    ).values[0].content
    return {
      logic: {
        and: [
          {
            [parameterValueContent === 'DOMESTIC' ? '==' : '!=']: [
              { var: 'TRANSACTION:destinationAmountDetails-country' },
              {
                var: 'BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__RECEIVER',
              },
            ],
          },
        ],
      },
    }
  }
