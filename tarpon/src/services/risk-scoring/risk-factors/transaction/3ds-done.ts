import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueLiteral } from '@/@types/openapi-internal/RiskParameterValueLiteral'

const THREE_DS_DONE_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: '3dsDone',
  name: '3DS done',
  description: 'Risk value for consumer (individuals) users',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const TRANSACTION_3DS_DONE_RISK_FACTOR =
  THREE_DS_DONE_RISK_FACTOR('TRANSACTION')

export const threeDsDoneV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          '==': [
            { var: 'TRANSACTION:originPaymentDetails-3dsDone' },
            (parameterValue.content as RiskParameterValueLiteral).content,
          ],
        },
      ],
    },
  }
}
