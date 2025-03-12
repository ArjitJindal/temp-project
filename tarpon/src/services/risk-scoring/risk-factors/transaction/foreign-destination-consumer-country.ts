import { RiskFactorLogicGenerator, V2V8RiskFactor } from '../types'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskParameterValueMultiple } from '@/@types/openapi-internal/RiskParameterValueMultiple'

const FOREIGN_DESTINATION_CONSUMER_COUNTRY_RISK_FACTOR = (
  entityType: RiskEntityType
): V2V8RiskFactor => ({
  parameter: 'domesticOrForeignDestinationCountryConsumer',
  name: 'Foreign destination country (Consumer)',
  description:
    'Risk value based on whether the user country of residence is same as transaction destination country',
  defaultRiskLevel: 'VERY_HIGH',
  defaultWeight: 1,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  status: 'INACTIVE',
  valueType: 'MULTIPLE',
  type: entityType,
  isDerived: true,
  dataType: 'RESIDENCE_TYPES',
})

export const TRANSACTION_FOREIGN_DESTINATION_CONSUMER_COUNTRY_RISK_FACTOR =
  FOREIGN_DESTINATION_CONSUMER_COUNTRY_RISK_FACTOR('TRANSACTION')

export const foreignDestinationConsumerCountryV8Logic: RiskFactorLogicGenerator =
  (parameterValue: RiskParameterValue): { logic: any } => {
    const parameterValueContent = (
      parameterValue.content as RiskParameterValueMultiple
    ).values[0].content
    const migratedLogic = {
      logic: {
        and: [
          {
            '==': [{ var: 'USER:type__RECEIVER' }, 'CONSUMER'],
          },
          {
            '!=': [{ var: 'TRANSACTION:destinationUserId' }, null],
          },
          {
            [parameterValueContent === 'DOMESTIC' ? '==' : '!=']: [
              { var: 'TRANSACTION:destinationAmountDetails-country' },
              { var: 'CONSUMER_USER:userDetails-countryOfResidence__RECEIVER' },
            ],
          },
        ],
      },
    }
    if (parameterValueContent === 'DOMESTIC') {
      migratedLogic.logic.and.push(
        ...[
          {
            '!=': [
              { var: 'TRANSACTION:destinationAmountDetails-country' },
              null,
            ],
          },
          {
            '!=': [
              { var: 'CONSUMER_USER:userDetails-countryOfResidence__RECEIVER' },
              null,
            ],
          },
        ]
      )
    }
    return migratedLogic
  }
