import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'

const FOREIGN_ORIGIN_BUSINESS_COUNTRY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'domesticOrForeignOriginCountryBusiness',
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
  isDerived: true,
  dataType: 'RESIDENCE_TYPES',
})

export const TRANSACTION_FOREIGN_ORIGIN_BUSINESS_COUNTRY_RISK_FACTOR =
  FOREIGN_ORIGIN_BUSINESS_COUNTRY_RISK_FACTOR('TRANSACTION')

export const foreignOriginBusinessCountryV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const parameterValueContent = (
    parameterValue.content as RiskParameterValueMultiple
  ).values[0].content
  const migratedLogic = {
    logic: {
      and: [
        {
          '==': [{ var: 'USER:type__SENDER' }, 'BUSINESS'],
        },
        {
          '!=': [{ var: 'TRANSACTION:originUserId' }, null],
        },
        {
          [parameterValueContent === 'DOMESTIC' ? '==' : '!=']: [
            { var: 'TRANSACTION:originAmountDetails-country' },
            {
              var: 'BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__SENDER',
            },
          ],
        },
      ],
    },
  }
  if (parameterValueContent === 'DOMESTIC') {
    migratedLogic.logic.and.push(
      ...[
        {
          '!=': [{ var: 'TRANSACTION:originAmountDetails-country' }, null],
        },
        {
          '!=': [
            {
              var: 'BUSINESS_USER:legalEntity-companyRegistrationDetails-registrationCountry__SENDER',
            },
            null,
          ],
        },
      ]
    )
  }
  return migratedLogic
}
