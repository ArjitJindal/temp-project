import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const DESTINATION_PAYMENT_METHOD_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'destinationPaymentDetails.method',
  name: 'Destination payment method',
  description: 'Risk based on transaction destination payment method',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
  isDerived: false,
  dataType: 'PAYMENT_METHOD',
})

export const TRANSACTION_DESTINATION_PAYMENT_METHOD_RISK_FACTOR =
  DESTINATION_PAYMENT_METHOD_RISK_FACTOR('TRANSACTION')

export const destinationPaymentMethodV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'TRANSACTION:destinationPaymentDetails-method' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
