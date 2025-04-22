import { uniqueId } from 'lodash'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DEFAULT_RISK_VALUE } from '@/services/risk-scoring/utils'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'

export const TEST_CONSUMER_USER_RISK_PARAMETER: RiskFactor = {
  parameter: 'type',
  id: uniqueId(),
  status: 'ACTIVE',
  name: 'Test consumer user type',
  description: 'Test description',
  logicAggregationVariables: [],
  logicEntityVariables: [],
  isDerived: true,
  type: 'CONSUMER_USER',
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [
            {
              kind: 'LITERAL',
              content: 'CONSUMER',
            },
          ],
        },
      },
      riskValue: {
        type: 'RISK_SCORE',
        value: 50,
      },
    },
  ],
  defaultWeight: 0.5,
  defaultRiskScore: 90,
  defaultRiskLevel: 'VERY_HIGH',
}

export const TEST_BUSINESS_USER_RISK_PARAMETER: RiskFactor = {
  id: uniqueId(),
  name: 'Test Business user type',
  description: 'Test description',
  parameter: 'type',
  status: 'ACTIVE',
  isDerived: true,
  type: 'BUSINESS',
  logicAggregationVariables: [],
  logicEntityVariables: [],
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [
            {
              kind: 'LITERAL',
              content: 'REGISTERED',
            },
          ],
        },
      },
      riskValue: {
        type: 'RISK_SCORE',
        value: 50,
      },
    },
  ],
  defaultWeight: 0.5,
  defaultRiskScore: 90,
  defaultRiskLevel: 'VERY_HIGH',
}

export const TEST_VARIABLE_RISK_ITEM: RiskFactor = {
  name: 'Test origin amount details country',
  description: 'Test description',
  id: uniqueId('RF'),
  parameter: 'originAmountDetails.country',
  defaultWeight: 1,
  status: 'ACTIVE',
  isDerived: false,
  type: 'TRANSACTION',
  defaultRiskLevel: 'VERY_HIGH',
  defaultRiskScore: 90,
  logicAggregationVariables: [],
  logicEntityVariables: [],
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [
            {
              kind: 'LITERAL',
              content: 'IN',
            },
          ],
        },
      },
      riskValue: {
        type: 'RISK_LEVEL',
        value: 'MEDIUM',
      },
    },
  ],
}
export const TEST_TRANSACTION_RISK_PARAMETERS: ParameterAttributeRiskValues[] =
  [
    {
      parameter: 'originAmountDetails.country',
      isActive: true,
      isDerived: false,
      riskEntityType: 'TRANSACTION',
      defaultValue: DEFAULT_RISK_VALUE,
      weight: 1,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'IN',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'destinationAmountDetails.country',
      isActive: true,
      isDerived: false,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      defaultValue: DEFAULT_RISK_VALUE,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'IN',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'destinationPaymentDetails.method',
      isActive: true,
      isDerived: false,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      defaultValue: DEFAULT_RISK_VALUE,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'CARD',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'originPaymentDetails.method',
      isActive: true,
      isDerived: false,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      defaultValue: DEFAULT_RISK_VALUE,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'CARD',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'originAmountDetails.transactionCurrency',
      isActive: true,
      isDerived: false,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      defaultValue: DEFAULT_RISK_VALUE,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'INR',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'destinationAmountDetails.transactionCurrency',
      isActive: true,
      isDerived: false,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      defaultValue: DEFAULT_RISK_VALUE,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'INR',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'ipAddressCountry',
      isActive: true,
      isDerived: true,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      defaultValue: { type: 'RISK_LEVEL', value: 'MEDIUM' },
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'MULTIPLE',
              values: [
                {
                  kind: 'LITERAL',
                  content: 'US',
                },
              ],
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
    },
    {
      parameter: '3dsDone',
      isActive: true,
      isDerived: true,
      riskEntityType: 'TRANSACTION',
      weight: 1,
      defaultValue: DEFAULT_RISK_VALUE,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: true,
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      isNullableAllowed: true,
      parameterType: 'VARIABLE',
    },
    {
      parameter: 'originAmountDetails.transactionAmount',
      isActive: true,
      isDerived: true,
      riskEntityType: 'TRANSACTION',
      weight: 1,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'AMOUNT_RANGE',
              start: 110000,
              end: 130000,
              currency: 'USD',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
      defaultValue: DEFAULT_RISK_VALUE,
    },
    {
      parameter: 'destinationAmountDetails.transactionAmount',
      isActive: true,
      isDerived: true,
      weight: 1,
      riskEntityType: 'TRANSACTION',
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'AMOUNT_RANGE',
              start: 110000,
              end: 130000,
              currency: 'USD',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ],
      parameterType: 'VARIABLE',
      defaultValue: DEFAULT_RISK_VALUE,
    },
  ]
export const TEST_ITERABLE_RISK_ITEM: ParameterAttributeRiskValues = {
  parameter: 'shareHolders',
  targetIterableParameter: 'generalDetails.countryOfNationality',
  isActive: true,
  weight: 1,
  isDerived: false,
  riskEntityType: 'TRANSACTION',
  defaultValue: DEFAULT_RISK_VALUE,
  riskLevelAssignmentValues: [
    {
      parameterValue: {
        content: {
          kind: 'MULTIPLE',
          values: [
            {
              kind: 'LITERAL',
              content: 'IN',
            },
          ],
        },
      },
      riskValue: {
        type: 'RISK_LEVEL',
        value: 'MEDIUM',
      },
    },
  ],
  parameterType: 'ITERABLE',
}

export function setUpRiskFactorsHook(
  tenantId: string,
  riskFactors: RiskFactor[]
) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]
  beforeAll(async () => {
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
    })
    for (const riskFactor of riskFactors) {
      await riskRepository.createOrUpdateRiskFactor(riskFactor)
      cleanups.push(async () => {
        await riskRepository.deleteRiskFactor(riskFactor.id)
      })
    }
  })

  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
  })
}

export const getTestRiskFactor = (
  riskFactor: Partial<RiskFactor>
): RiskFactor => ({
  id: uniqueId('RF'),
  status: 'ACTIVE',
  defaultWeight: 1,
  name: 'Test Risk Factor',
  description: 'Test factor',
  type: 'TRANSACTION',
  logicAggregationVariables: [],
  logicEntityVariables: [],
  defaultRiskScore: 75,
  defaultRiskLevel: 'HIGH',
  riskLevelLogic: [],
  ...riskFactor,
})
