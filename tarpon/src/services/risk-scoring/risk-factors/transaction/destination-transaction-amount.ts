import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskParameterValueDayRange } from '@/@types/openapi-internal/all'

const DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'destinationAmountDetails.transactionAmount',
  name: 'Destination transaction amount',
  description: 'Risk based on destination transaction amount',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
})

export const TRANSACTION_DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR =
  DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR('TRANSACTION')

export const destinationTransactionAmountV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  const range = parameterValue.content as RiskParameterValueDayRange
  return {
    logic: {
      and: [
        {
          '<=': [
            range.start,
            { var: 'TRANSACTION:destinationAmountDetails-transactionAmount' },
            range.end,
          ],
        },
      ],
    },
  }
}
