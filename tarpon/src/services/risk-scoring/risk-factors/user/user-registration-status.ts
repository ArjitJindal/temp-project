import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const CUSTOMER_REGISTRATION_STATUS_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
  name: 'User registration status',
  description: 'Risk based on business user registration status',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
  isDerived: false,
  dataType: 'USER_REGISTRATION_STATUS',
})

export const BUSINESS_USER_REGISTRATION_STATUS_RISK_FACTOR =
  CUSTOMER_REGISTRATION_STATUS_RISK_FACTOR('BUSINESS')

export const userRegistrationStatusV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            {
              var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-userRegistrationStatus__SENDER',
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
