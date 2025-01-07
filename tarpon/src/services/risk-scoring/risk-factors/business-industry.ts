import { RiskFactorLogicGenerator, V2V8RiskFactor } from './types'
import { RiskParameterValueLiteral } from '@/@types/openapi-internal/RiskParameterValueLiteral'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const CUSTOMER_INDUSTRY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
  name: 'Business industry',
  description:
    'Risk value based on the industry in which the business operates',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const BUSINESS_INDUSTRY_RISK_FACTOR =
  CUSTOMER_INDUSTRY_RISK_FACTOR('BUSINESS')

export const businessIndustryV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          all: [
            {
              var: 'BUSINESS_USER:legalEntity-companyGeneralDetails-businessIndustry__SENDER',
            },
            {
              in: [
                { var: '' },
                (parameterValue.content as RiskParameterValueLiteral).content,
              ],
            },
          ],
        },
      ],
    },
  }
}
