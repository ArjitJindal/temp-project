import { uniqueId } from 'lodash'
import { getTestTenantId } from './tenant-test-utils'
import { setUpUsersHooks } from './user-test-utils'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskScoringService } from '@/services/risk-scoring'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DEFAULT_RISK_VALUE } from '@/services/risk-scoring/utils'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'

export const TEST_CONSUMER_USER_RISK_PARAMETER: ParameterAttributeRiskValues = {
  parameter: 'type',
  isActive: true,
  isDerived: true,
  riskEntityType: 'CONSUMER_USER',
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
  parameterType: 'VARIABLE',
  weight: 0.5,
  defaultValue: {
    type: 'RISK_LEVEL',
    value: 'VERY_HIGH',
  },
}

export const TEST_VARIABLE_RISK_ITEM: ParameterAttributeRiskValues = {
  parameter: 'originAmountDetails.country',
  weight: 1,
  isActive: true,
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
  parameterType: 'VARIABLE',
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

type KrsTestCase = {
  testName: string
  user: User | Business
  expectedScore: number
}
export function createKrsRiskFactorTestCases(
  parameter: RiskFactorParameter,
  riskClassificationValues: RiskClassificationScore[],
  parameterRiskLevels: ParameterAttributeRiskValues,
  testCases: Array<KrsTestCase>
) {
  describe(parameter, () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    let riskScoringService: RiskScoringService

    beforeAll(async () => {
      const mongoDb = await getMongoDbClient()
      const riskRepository = new RiskRepository(TEST_TENANT_ID, {
        dynamoDb,
        mongoDb,
      })
      riskScoringService = new RiskScoringService(TEST_TENANT_ID, {
        dynamoDb,
        mongoDb,
      })
      await riskRepository.createOrUpdateRiskClassificationConfig(
        riskClassificationValues
      )
      await riskRepository.createOrUpdateParameterRiskItem(parameterRiskLevels)
    })

    describe.each<KrsTestCase>(testCases)(
      '',
      ({ testName, user, expectedScore }) => {
        test(testName, async () => {
          const riskRepository = new RiskRepository(TEST_TENANT_ID, {
            dynamoDb,
          })
          await riskScoringService.updateInitialRiskScores(user)
          expect(
            (await riskRepository.getKrsScore(user.userId))?.krsScore
          ).toBe(expectedScore)
        })
      }
    )
  })
}

type ArsTestCase = {
  testName: string
  transaction: Transaction
  users: Array<User | Business>
  expectedScore: number
}

export function createArsRiskFactorTestCases(
  parameter: RiskFactorParameter,
  riskClassificationValues: RiskClassificationScore[],
  parameterRiskLevels: ParameterAttributeRiskValues,
  testCases: Array<ArsTestCase>,
  beforeAllHook?: (tenantId: string) => Promise<void>
) {
  describe(parameter, () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    let riskScoringService: RiskScoringService

    beforeAll(async () => {
      const mongoDb = await getMongoDbClient()
      const riskRepository = new RiskRepository(TEST_TENANT_ID, {
        dynamoDb,
        mongoDb,
      })
      riskScoringService = new RiskScoringService(TEST_TENANT_ID, {
        dynamoDb,
        mongoDb,
      })
      await riskRepository.createOrUpdateRiskClassificationConfig(
        riskClassificationValues
      )
      await riskRepository.createOrUpdateParameterRiskItem(parameterRiskLevels)
      if (beforeAllHook) {
        await beforeAllHook(TEST_TENANT_ID)
      }
    })

    describe.each<ArsTestCase>(testCases)(
      '',
      ({ testName, transaction, users, expectedScore }) => {
        setUpUsersHooks(TEST_TENANT_ID, users)
        test(testName, async () => {
          const riskRepository = new RiskRepository(TEST_TENANT_ID, {
            dynamoDb,
          })
          await riskScoringService.updateDynamicRiskScores(transaction)
          expect(
            (await riskRepository.getArsScore(transaction.transactionId))
              ?.arsScore
          ).toBe(expectedScore)
        })
      }
    )
  })
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
