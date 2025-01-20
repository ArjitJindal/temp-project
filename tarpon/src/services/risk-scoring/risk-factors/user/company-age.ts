import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueDayRange } from '@/@types/openapi-internal/RiskParameterValueDayRange'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const COMPANY_AGE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
  name: 'Company age',
  description: 'Risk based on business age range (years)s',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'RANGE',
  type: entityType,
})

export const BUSINESS_COMPANY_AGE_RISK_FACTOR =
  COMPANY_AGE_RISK_FACTOR('BUSINESS')

export const companyAgeV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const range = parameterValue.content as RiskParameterValueDayRange
  return {
    logic: {
      and: [
        {
          '<=': [
            range.start,
            { var: 'BUSINESS_USER:ageYears__SENDER' },
            range.end,
          ],
        },
      ],
    },
  }
}
