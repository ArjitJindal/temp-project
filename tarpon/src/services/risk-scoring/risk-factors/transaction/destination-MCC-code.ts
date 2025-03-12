import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueLiteral } from '@/@types/openapi-internal/RiskParameterValueLiteral'

const DESTINATION_MCC_CODE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'destinationMccCode',
  name: 'Destination MCC code',
  description: 'Risk based on destination MCC code',
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

export const TRANSACTION_DESTINATION_MCC_CODE_RISK_FACTOR =
  DESTINATION_MCC_CODE_RISK_FACTOR('TRANSACTION')

export const destinationMccCodeV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          '==': [
            {
              var: 'TRANSACTION:destinationPaymentDetails-merchantDetails-MCC',
            },
            (parameterValue.content as RiskParameterValueLiteral).content,
          ],
        },
      ],
    },
  }
}
