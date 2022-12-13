import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesMatchTypeEnum,
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesParameterTypeEnum,
  ParameterAttributeRiskValuesRiskScoreTypeEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskParameterValueLiteralKindEnum } from '@/@types/openapi-internal/RiskParameterValueLiteral'
import { RiskParameterValueMultipleKindEnum } from '@/@types/openapi-internal/RiskParameterValueMultiple'

export const testRiskItem: ParameterAttributeRiskValues = {
  parameter:
    'originAmountDetails.country' as ParameterAttributeRiskValuesParameterEnum,
  isActive: true,
  isDerived: false,
  riskEntityType: 'TRANSACTION' as RiskEntityType,
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE' as RiskParameterValueMultipleKindEnum,
          values: [
            {
              kind: 'LITERAL' as RiskParameterValueLiteralKindEnum,
              content: 'IN',
            },
          ],
        },
      },
      riskLevel: 'MEDIUM' as RiskLevel,
    },
  ],
  parameterType: 'VARIABLE' as ParameterAttributeRiskValuesParameterTypeEnum,
  matchType: 'DIRECT' as ParameterAttributeRiskValuesMatchTypeEnum,
  riskScoreType: 'ARS' as ParameterAttributeRiskValuesRiskScoreTypeEnum,
}
