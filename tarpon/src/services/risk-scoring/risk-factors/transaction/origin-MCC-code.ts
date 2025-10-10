import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueLiteral } from '@/@types/openapi-internal/RiskParameterValueLiteral'

const ORIGIN_MCC_CODE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'originMccCode',
  name: 'Origin MCC code',
  description: 'Risk based on origin MCC code',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  valueType: 'LITERAL',
  type: entityType,
  status: 'INACTIVE',
  isDerived: true,
  dataType: 'STRING',
})

export const TRANSACTION_ORIGIN_MCC_CODE_RISK_FACTOR =
  ORIGIN_MCC_CODE_RISK_FACTOR('TRANSACTION')

export const originMccCodeV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          '==': [
            { var: 'TRANSACTION:originPaymentDetails-merchantDetails-MCC' },
            (parameterValue.content as RiskParameterValueLiteral).content,
          ],
        },
      ],
    },
  }
}
