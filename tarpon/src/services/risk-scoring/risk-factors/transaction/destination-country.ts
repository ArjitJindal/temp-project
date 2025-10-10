import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const DESTINATION_COUNTRY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'destinationAmountDetails.country',
  name: 'Destination country',
  description: 'Risk based on transaction destination country',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
  isDerived: false,
  dataType: 'COUNTRY',
})

export const TRANSACTION_DESTINATION_COUNTRY_RISK_FACTOR =
  DESTINATION_COUNTRY_RISK_FACTOR('TRANSACTION')

export const destinationCountryV8Logic: RiskFactorLogicGenerator = (
  parameterValue: RiskParameterValue
): { logic: any } => {
  return {
    logic: {
      and: [
        {
          in: [
            { var: 'TRANSACTION:destinationAmountDetails-country' },
            (parameterValue.content as RiskParameterValueMultiple).values.map(
              (val) => val.content
            ),
          ],
        },
      ],
    },
  }
}
