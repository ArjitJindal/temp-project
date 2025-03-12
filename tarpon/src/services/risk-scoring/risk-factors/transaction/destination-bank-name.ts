import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const DESTINATION_BANK_NAME_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'destinationPaymentDetails.bankName',
  name: 'Destination bank name',
  description:
    'Risk value based on destination bank name under generic bank account, ACH, IBAN and SWIFT',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
  isDerived: true,
  dataType: 'BANK_NAMES',
})

export const TRANSACTION_DESTINATION_BANK_NAME_RISK_FACTOR =
  DESTINATION_BANK_NAME_RISK_FACTOR('TRANSACTION')

export const destinationBankNameV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'TRANSACTION:destinationPaymentDetails-bankName' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
