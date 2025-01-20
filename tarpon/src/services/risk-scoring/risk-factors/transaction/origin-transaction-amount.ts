import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueAmountRange } from '@/@types/openapi-internal/all'

const ORIGIN_TRANSACTION_AMOUNT_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'originAmountDetails.transactionAmount',
  name: 'Origin transaction amount',
  description: 'Risk based on origin transaction amount',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const TRANSACTION_ORIGIN_TRANSACTION_AMOUNT_RISK_FACTOR =
  ORIGIN_TRANSACTION_AMOUNT_RISK_FACTOR('TRANSACTION')

export const originTransactionAmountV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const range = parameterValue.content as RiskParameterValueAmountRange
  return {
    logic: {
      and: [
        {
          '<=': [
            range.start,
            { var: 'TRANSACTION:originAmountDetails-transactionAmount' },
            range.end,
          ],
        },
        {
          '!=': [
            { var: 'TRANSACTION:originAmountDetails-transactionAmount' },
            range.end,
          ],
        },
      ],
    },
  }
}
