import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const ORIGIN_BANK_NAME_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'originPaymentDetails.bankName',
  name: 'Origin bank name',
  description:
    'Risk value based on origin bank name under generic bank account, ACH, IBAN and SWIFT',
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

export const TRANSACTION_ORIGIN_BANK_NAME_RISK_FACTOR =
  ORIGIN_BANK_NAME_RISK_FACTOR('TRANSACTION')

export const originBankNameV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'TRANSACTION:originPaymentDetails-bankName' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
