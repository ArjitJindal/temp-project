import { getTestTenantId } from './tenant-test-utils'
import { setUpUsersHooks } from './user-test-utils'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskScoringService } from '@/services/risk-scoring'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export const TEST_VARIABLE_RISK_ITEM: ParameterAttributeRiskValues = {
  parameter: 'originAmountDetails.country',
  isActive: true,
  isDerived: false,
  riskEntityType: 'TRANSACTION',
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
      riskLevel: 'MEDIUM',
    },
  ],
  parameterType: 'VARIABLE',
}

export const TEST_ITERABLE_RISK_ITEM: ParameterAttributeRiskValues = {
  parameter: 'shareHolders',
  targetIterableParameter: 'generalDetails.countryOfNationality',
  isActive: true,
  isDerived: false,
  riskEntityType: 'TRANSACTION',
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
      riskLevel: 'MEDIUM',
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
  parameter: ParameterAttributeRiskValuesParameterEnum,
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
  parameter: ParameterAttributeRiskValuesParameterEnum,
  riskClassificationValues: RiskClassificationScore[],
  parameterRiskLevels: ParameterAttributeRiskValues,
  testCases: Array<ArsTestCase>
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
